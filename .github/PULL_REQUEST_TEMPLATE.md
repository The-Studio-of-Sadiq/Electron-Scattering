## Summary

Provide a concise explanation of the changes introduced in this pull request and the motivation behind them.

## Type of Change

Please select the options that apply:

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring / Chore (no functional changes to physics or runtime)
- [ ] Physics engine or numerical model adjustment

## Related Issue

Closes #

## Physics Impact

- **Does this change alter any numerical results or physical observables?**
  - [ ] No (pure UI, tooling, documentation, or refactoring)
  - [ ] Yes (explain below)

  *If yes, describe the changes to the cross sections, phase shifts, potentials, or angular distributions, and explain why the change is physically justified:*

- **Which validation suites and parity tests were run locally?**
  - [ ] `wasm/features.test.ts`
  - [ ] `wasm/density.test.ts`
  - [ ] `wasm/overrides.test.ts`
  - [ ] `wasm/outputs.test.ts`
  - [ ] `wasm/server.test.ts`
  - [ ] `wasm/browser.test.ts`
  - [ ] `wasm/parity.test.ts` (native gfortran vs WebAssembly)

## Checklist

Before submitting this pull request, please verify:

- [ ] My code conforms to the project's TypeScript strict guidelines.
- [ ] `npm run lint` passes without any errors (`tsc --noEmit`).
- [ ] `npm run build` completes successfully.
- [ ] All relevant test suites in `wasm/*.test.ts` pass locally.
- [ ] The `fortran/` directory is completely untouched (`git diff fortran/` is empty).
- [ ] Documentation has been updated in `README.md` and/or `docs/Documentation.md` if applicable.
- [ ] `CHANGELOG.md` has been updated with a description of the changes.
