#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node wasm/patch-elsepa.mjs <source dir> <output dir>');
  process.exit(1);
}

const [srcDir, outDir] = args;
fs.mkdirSync(outDir, { recursive: true });

function countOccurrences(content, needle) {
  let count = 0;
  let pos = 0;
  while ((pos = content.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

function applyPatch(filename, content, anchor, replacement, name) {
  const replCount = countOccurrences(content, replacement);
  if (replCount === 1) {
    // Already patched (idempotent re-run)
    return content;
  }
  const anchorCount = countOccurrences(content, anchor);
  if (anchorCount === 1) {
    return content.replace(anchor, replacement);
  }
  if (anchorCount === 0) {
    console.error(`Error in ${filename}: Anchor for '${name}' not found.`);
    process.exit(1);
  }
  console.error(`Error in ${filename}: Anchor for '${name}' found ${anchorCount} times (expected exactly 1).`);
  process.exit(1);
}

// 1. Copy radial.f and elscatm.f unmodified
for (const file of ['radial.f', 'elscatm.f']) {
  const srcPath = path.join(srcDir, file);
  const outPath = path.join(outDir, file);
  fs.copyFileSync(srcPath, outPath);
}

// 2. Patch elscata.f
let elscata = fs.readFileSync(path.join(srcDir, 'elscata.f'), 'latin1').replace(/\r\n/g, '\n');

// 2a. Common block declaration
elscata = applyPatch(
  'elscata.f',
  elscata,
  `C  ****  Phase shifts.
      PARAMETER (NDM=25000)
      COMMON/PHASES/DP(NDM),DM(NDM),NPH,ISUMP
      COMMON/PHASEI/DPJ(NDM),DMJ(NDM)`,
  `C  ****  Phase shifts.
      PARAMETER (NDM=25000)
      COMMON/PHASES/DP(NDM),DM(NDM),NPH,ISUMP
      COMMON/PHASEI/DPJ(NDM),DMJ(NDM)
      DOUBLE PRECISION AWOVR,R1OVR,R2OVR
      COMMON/ELSOVR/AWOVR,R1OVR,R2OVR`,
  'elscata: COMMON/ELSOVR/ declaration'
);

// 2b. Override variables zero-initialisation
elscata = applyPatch(
  'elscata.f',
  elscata,
  `C  ****  Default model.
      IELEC =-1        ! electron`,
  `C  ****  Default model.
      AWOVR =0.0D0
      R1OVR =0.0D0
      R2OVR =0.0D0
      IELEC =-1        ! electron`,
  'elscata: AWOVR/R1OVR/R2OVR zero-init'
);

// 2c. Input keywords ATWGHT, NUCRAD, NUCSKN
elscata = applyPatch(
  'elscata.f',
  elscata,
  `      ELSE IF(KWORD.EQ.'IHEF') THEN
        READ(BUFFER,*) IHEF
        IF(IHEF.NE.0.AND.IHEF.NE.2) IHEF=1
      ELSE IF(KWORD.EQ.'EV    ') THEN`,
  `      ELSE IF(KWORD.EQ.'IHEF') THEN
        READ(BUFFER,*) IHEF
        IF(IHEF.NE.0.AND.IHEF.NE.2) IHEF=1
      ELSE IF(KWORD.EQ.'ATWGHT') THEN
        READ(BUFFER,*) AWOVR
      ELSE IF(KWORD.EQ.'NUCRAD') THEN
        READ(BUFFER,*) R1OVR
      ELSE IF(KWORD.EQ.'NUCSKN') THEN
        READ(BUFFER,*) R2OVR
      ELSE IF(KWORD.EQ.'EV    ') THEN`,
  'elscata: ATWGHT/NUCRAD/NUCSKN keywords'
);

// 2d. Remove negative ion STOP
elscata = applyPatch(
  'elscata.f',
  elscata,
  `      ELSE IF(KWORD.EQ.'NELEC ') THEN
        READ(BUFFER,*) NELEC
        IF(NELEC.LT.0) NELEC=IZ
        IF(NELEC.GT.IZ) THEN
          WRITE(6,*) 'NELEC =',NELEC
          STOP 'Negative ion.'
        ENDIF
      ELSE IF(KWORD.EQ.'MELEC ') THEN`,
  `      ELSE IF(KWORD.EQ.'NELEC ') THEN
        READ(BUFFER,*) NELEC
        IF(NELEC.LT.0) NELEC=IZ
      ELSE IF(KWORD.EQ.'MELEC ') THEN`,
  'elscata: remove negative ion STOP'
);

fs.writeFileSync(path.join(outDir, 'elscata.f'), elscata, 'latin1');

// 3. Patch elsepa2020.f
let elsepa = fs.readFileSync(path.join(srcDir, 'elsepa2020.f'), 'latin1').replace(/\r\n/g, '\n');

// 3a. COMMON block declaration in EFIELD
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      SUBROUTINE EFIELD(IZ,NELEC,MNUCL,MELEC,IW,IWR)
C
C     Electrostatic potential of atoms and ions.
C
C  Input parameters:
C     IZ ....... atomic number (INTEGER).
C     NELEC .... number of electrons (INTEGER, .GE.0 and .LE.IZ).
C     MNUCL .... nuclear density model (INTEGER).
C                 1 --> point nucleus,
C                 2 --> uniform distribution,
C                 3 --> Fermi distribution,
C                 4 --> Helm's uniform-uniform distribution.
C     MELEC .... electron density model (INTEGER).
C                 1 --> TFM analytical density,
C                 2 --> TFD analytical density,
C                 3 --> DHFS analytical density,
C                 4 --> DF density from pre-evaluated files,
C                 5 --> density read from file 'density.usr'.
C     IW ....... output unit (to be defined in the main program).
C     IWR ...... if >0, the potential is written in a file named
C                'esfield.dat'.
C
C  Output (through common block /CFIELD/):
C     R(I) ..... radial grid points. R(1)=0.0D0.
C     RVN(I) ... nuclear potential times R.
C     DEN(I) ... radial electron density, i.e. the electron density
C                multiplied by 4*PI*R**2.
C     RVST(I) ... atomic electrostatic potential (nuclear+electronic)
C                times R.
C     NPOT ..... number of grid points where the potential function is
C                tabulated. For I.GT.NPOT, RVST(I) is set equal to
C                RVST(NPOT).
C
      USE CONSTANTS
C
      IMPLICIT DOUBLE PRECISION (A-H,O-Z), INTEGER*4 (I-N)`,
  `      SUBROUTINE EFIELD(IZ,NELEC,MNUCL,MELEC,IW,IWR)
C
C     Electrostatic potential of atoms and ions.
C
C  Input parameters:
C     IZ ....... atomic number (INTEGER).
C     NELEC .... number of electrons (INTEGER, .GE.0 and .LE.IZ).
C     MNUCL .... nuclear density model (INTEGER).
C                 1 --> point nucleus,
C                 2 --> uniform distribution,
C                 3 --> Fermi distribution,
C                 4 --> Helm's uniform-uniform distribution.
C     MELEC .... electron density model (INTEGER).
C                 1 --> TFM analytical density,
C                 2 --> TFD analytical density,
C                 3 --> DHFS analytical density,
C                 4 --> DF density from pre-evaluated files,
C                 5 --> density read from file 'density.usr'.
C     IW ....... output unit (to be defined in the main program).
C     IWR ...... if >0, the potential is written in a file named
C                'esfield.dat'.
C
C  Output (through common block /CFIELD/):
C     R(I) ..... radial grid points. R(1)=0.0D0.
C     RVN(I) ... nuclear potential times R.
C     DEN(I) ... radial electron density, i.e. the electron density
C                multiplied by 4*PI*R**2.
C     RVST(I) ... atomic electrostatic potential (nuclear+electronic)
C                times R.
C     NPOT ..... number of grid points where the potential function is
C                tabulated. For I.GT.NPOT, RVST(I) is set equal to
C                RVST(NPOT).
C
      USE CONSTANTS
C
      IMPLICIT DOUBLE PRECISION (A-H,O-Z), INTEGER*4 (I-N)
      DOUBLE PRECISION AWOVR,R1OVR,R2OVR
      COMMON/ELSOVR/AWOVR,R1OVR,R2OVR`,
  'elsepa2020: EFIELD COMMON/ELSOVR/ declaration'
);

// 3b. EFIELD: remove negative ion STOP, apply AW override, and write extra header line if override active
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      IF(IZ.LE.0) STOP 'EFIELD: Negative atomic number.'
      IF(IZ.GT.103) STOP 'EFIELD: Atomic number larger than 103.'
      IF(NELEC.GT.IZ) STOP 'EFIELD: Negative ion.'
      IF(NELEC.LT.0) STOP 'EFIELD: Negative number of electrons.'
C
      Z=DBLE(IZ)
      AW=ELAW(IZ)
      IF(IW.GT.0) WRITE(IW,1001) LSYMBL(IZ),IZ,AW
 1001 FORMAT(1X,'#',/1X,'# Element: ',A2,',  Z = ',I3,
     1  ',  atomic weight =',1P,E12.5,' g/mol')
      NDIN=1000`,
  `      IF(IZ.LE.0) STOP 'EFIELD: Negative atomic number.'
      IF(IZ.GT.103) STOP 'EFIELD: Atomic number larger than 103.'
      IF(NELEC.LT.0) STOP 'EFIELD: Negative number of electrons.'
C
      Z=DBLE(IZ)
      AW=ELAW(IZ)
      IF(AWOVR.GT.0.0D0) AW=AWOVR
      IF(IW.GT.0) WRITE(IW,1001) LSYMBL(IZ),IZ,AW
 1001 FORMAT(1X,'#',/1X,'# Element: ',A2,',  Z = ',I3,
     1  ',  atomic weight =',1P,E12.5,' g/mol')
      IF(IW.GT.0.AND.(AWOVR.GT.0.0D0.OR.R1OVR.GT.0.0D0.OR.
     1  R2OVR.GT.0.0D0)) THEN
        WRITE(IW,'(1X,''#'',/1X,
     1    ''# Nuclear parameters overridden by the user (ELSEPA'',
     2    '' extension)'')')
      ENDIF
      NDIN=1000`,
  'elsepa2020: EFIELD negative ion stop removal and AW/header override'
);

// 3c. EFIELD: Uniform model (MNUCL=2) override
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      ELSE IF (MNUCL.EQ.2) THEN
C  ****  The factor F2BOHR=1.889726D-5 transforms from fm to Bohr.
        R1=1.07D0*F2BOHR*AW**0.3333333333333333D0
        R2=2.0D0*F2BOHR
        R1=R1*SQRT((1.0D0+2.5D0*(R2/R1)**2)
     1             /(1.0D0+0.75D0*(R2/R1)**2))
        R0=R1/10.0D0`,
  `      ELSE IF (MNUCL.EQ.2) THEN
C  ****  The factor F2BOHR=1.889726D-5 transforms from fm to Bohr.
        R1=1.07D0*F2BOHR*AW**0.3333333333333333D0
        R2=2.0D0*F2BOHR
        R1=R1*SQRT((1.0D0+2.5D0*(R2/R1)**2)
     1             /(1.0D0+0.75D0*(R2/R1)**2))
        IF(R1OVR.GT.0.0D0) R1=R1OVR*F2BOHR
        R0=R1/10.0D0`,
  'elsepa2020: EFIELD uniform model R1 override'
);

// 3d. EFIELD: Fermi model (MNUCL=3) override
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      ELSE IF (MNUCL.EQ.3) THEN
        R1=1.07D0*F2BOHR*AW**0.3333333333333333D0
        R2=0.546D0*F2BOHR
        R0=R1/10.0D0`,
  `      ELSE IF (MNUCL.EQ.3) THEN
        R1=1.07D0*F2BOHR*AW**0.3333333333333333D0
        R2=0.546D0*F2BOHR
        IF(R1OVR.GT.0.0D0) R1=R1OVR*F2BOHR
        IF(R2OVR.GT.0.0D0) R2=R2OVR*F2BOHR
        R0=R1/10.0D0`,
  'elsepa2020: EFIELD Fermi model R1/R2 override'
);

// 3e. EFIELD: Helm model (MNUCL=4) override
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      ELSE
        RNUC=1.070D0*F2BOHR*AW**0.3333333333333333D0
        R1=0.96219D0*RNUC+0.435D0*F2BOHR
        R2=2.0D0*F2BOHR
        IF(IW.GT.0) WRITE(IW,1105) R1*A0B,R2*A0B`,
  `      ELSE
        RNUC=1.070D0*F2BOHR*AW**0.3333333333333333D0
        R1=0.96219D0*RNUC+0.435D0*F2BOHR
        R2=2.0D0*F2BOHR
        IF(R1OVR.GT.0.0D0) R1=R1OVR*F2BOHR
        IF(R2OVR.GT.0.0D0) R2=R2OVR*F2BOHR
        IF(IW.GT.0) WRITE(IW,1105) R1*A0B,R2*A0B`,
  'elsepa2020: EFIELD Helm model R1/R2 override'
);

// 3f. COMMON block declaration in HEBORN
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      COMMON/CDCSHE/Q2T(NGT),FQ(NGT),U1,U2,NQS,MOM
C
      DIMENSION ELAW(103)
C
      PARAMETER (NPC=1500)`,
  `      COMMON/CDCSHE/Q2T(NGT),FQ(NGT),U1,U2,NQS,MOM
C
      DIMENSION ELAW(103)
      DOUBLE PRECISION AWOVR,R1OVR,R2OVR
      COMMON/ELSOVR/AWOVR,R1OVR,R2OVR
C
      PARAMETER (NPC=1500)`,
  'elsepa2020: HEBORN COMMON/ELSOVR/ declaration'
);

// 3g. HEBORN: AW override
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      IF(IZ.LE.0) STOP 'HEBORN: Negative atomic number.'
      IF(IZ.GT.103) STOP 'HEBORN: Atomic number larger than 103.'
      AW=ELAW(IZ)
      WRITE(IW,1001) LSYMBL(IZ),IZ,AW`,
  `      IF(IZ.LE.0) STOP 'HEBORN: Negative atomic number.'
      IF(IZ.GT.103) STOP 'HEBORN: Atomic number larger than 103.'
      AW=ELAW(IZ)
      IF(AWOVR.GT.0.0D0) AW=AWOVR
      WRITE(IW,1001) LSYMBL(IZ),IZ,AW`,
  'elsepa2020: HEBORN AW override'
);

// 3h. HEBORN: Uniform model (MNUCL=2) override
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      ELSE IF (MNUCL.EQ.2) THEN
C  ****  Uniform distribution..
        R1=1.07D0*F2BOHR*AW**0.3333333333333333D0
        R2=2.00D0*F2BOHR
        R1=R1*SQRT((1.0D0+2.5D0*(R2/R1)**2)
     1             /(1.0D0+0.75D0*(R2/R1)**2))
        WRITE(IW,1004) R1*A0B`,
  `      ELSE IF (MNUCL.EQ.2) THEN
C  ****  Uniform distribution..
        R1=1.07D0*F2BOHR*AW**0.3333333333333333D0
        R2=2.00D0*F2BOHR
        R1=R1*SQRT((1.0D0+2.5D0*(R2/R1)**2)
     1             /(1.0D0+0.75D0*(R2/R1)**2))
        IF(R1OVR.GT.0.0D0) R1=R1OVR*F2BOHR
        WRITE(IW,1004) R1*A0B`,
  'elsepa2020: HEBORN uniform model R1 override'
);

// 3i. HEBORN: Helm/Fermi model override
elsepa = applyPatch(
  'elsepa2020.f',
  elsepa,
  `      ELSE IF(MNUCL.EQ.4.OR.MNUCL.EQ.3) THEN
C  ****  Helm's Uu distribution.
        RNUC=1.070D0*F2BOHR*AW**0.3333333333333333D0
        R1=0.962D0*RNUC+0.435D0*F2BOHR
        R2=2.0D0*F2BOHR
        IF(R2.GT.R1) THEN`,
  `      ELSE IF(MNUCL.EQ.4.OR.MNUCL.EQ.3) THEN
C  ****  Helm's Uu distribution.
        RNUC=1.070D0*F2BOHR*AW**0.3333333333333333D0
        IF(MNUCL.EQ.3.AND.R1OVR.GT.0.0D0) RNUC=R1OVR*F2BOHR
        R1=0.962D0*RNUC+0.435D0*F2BOHR
        R2=2.0D0*F2BOHR
        IF(MNUCL.EQ.4.AND.R1OVR.GT.0.0D0) R1=R1OVR*F2BOHR
        IF(MNUCL.EQ.4.AND.R2OVR.GT.0.0D0) R2=R2OVR*F2BOHR
        IF(R2.GT.R1) THEN`,
  // Here ELSEPA represents the Fermi model (MNUCL 3) by a Helm distribution whose RNUC is the
  // Fermi radius, so a Fermi radius override sets RNUC; the Helm skin is not the Fermi skin.
  'elsepa2020: HEBORN nuclear R1/R2 override'
);

fs.writeFileSync(path.join(outDir, 'elsepa2020.f'), elsepa, 'latin1');
console.log(`Successfully patched ELSEPA Fortran into ${outDir}`);
