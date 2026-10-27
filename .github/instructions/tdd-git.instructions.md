---
description: "Use when changing behavior, committing, branching, merging, or pushing in this repo. Requires a feature branch, separate TDD red/green/refactor commits, a pull request at the red step so GitHub Actions records the failing tests, a no-ff merge commit, and a history-preserving push."
---
# TDD git scheme

Use this for behavior changes. Do not squash, rebase, or force-push the commits away.

## Branch

- Start from the repository's default branch.
- Create a new branch for the change. Do not commit the work directly on the default branch.

## Commits

Make three commits on the feature branch, in order. Run the tests before each commit.

1. `[red]` — failing tests only, plus any test harness those tests need to run. Confirm they fail for the new behavior. Then push this commit alone and open a pull request into the default branch. GitHub Actions runs on that pull request. Wait until the failed run is recorded on the pull request before the next commit. Do not treat that failure as a problem to fix before opening the pull request, and do not push the green commit first or Actions may skip the red result.
2. `[green]` — the minimum production code that makes those tests pass. Confirm they pass, then push to the same pull request.
3. `[refactor]` — cleanup only (names, shared helpers, docs). Tests stay green. Push to the same pull request.

Commit subjects start with `[red]`, `[green]`, or `[refactor]`.

## Merge

- Check out the default branch.
- Merge with `git merge --no-ff <branch>`.
- The merge message names the change and lists the red, green, and refactor steps.
- Leave the feature branch in place.

## Push

Push the feature branch and the updated default branch. Do not rewrite history.

The feature branch stays on the remote so the red, green, and refactor commits remain visible beside the merge commit. Leave the pull request and its red Actions result on GitHub.
