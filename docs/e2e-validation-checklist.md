# End-to-End Validation Checklist

Complete this checklist on your local machine after:

1. AWS account access is recovered
2. Private S3 bucket is configured (`ap-south-1`)
3. PostgreSQL is configured and migrations applied
4. `.env` is filled in locally (never committed)

PR #2 must remain **unmerged** until these checks pass.

---

## Pre-flight

- [ ] `npm run check:env` passes
- [ ] `npm run db:status` shows migration applied
- [ ] `npm run dev` starts without errors
- [ ] `npm run test:e2e-smoke` passes (with dev server running)
- [ ] `npm test` passes (25 tests)

---

## User A flow

- [ ] Register a new account at `/register`
- [ ] Log in at `/login`
- [ ] Upload a normal file (e.g. `notes.txt`, `.pdf`, `.png`)
- [ ] File appears in dashboard with updated storage usage
- [ ] Download the file successfully
- [ ] Delete the file; storage usage decreases

Record User A's file ID from browser dev tools or network tab for User B test.

---

## User B isolation

- [ ] Register/login as a **different** user (User B)
- [ ] Attempt to GET `/api/files/{userAFileId}` while logged in as User B
- [ ] Verify response is **404 Not found** (not the file contents)
- [ ] Attempt unauthenticated GET `/api/files` → **401 Unauthorized**

---

## Security policy tests

- [ ] Upload `setup.exe` → rejected (**415**)
- [ ] Upload an uncommon but normal file (e.g. `.parquet`, `.blend`, unknown extension) → accepted
- [ ] Upload with path-like name `../secret.txt` → rejected
- [ ] Fill storage near quota; upload that would exceed quota → rejected (**403**)

---

## S3 and credential checks

- [ ] Browser network tab shows presigned S3 URLs only (no AWS access keys in responses)
- [ ] S3 bucket Block Public Access remains enabled
- [ ] No public object URLs work without presigned parameters
- [ ] Download response uses attachment behavior (file downloads rather than executing inline)

---

## After all checks pass

- [ ] Share pass/fail summary with the team (no secrets)
- [ ] Decide whether to merge PR #2

---

## If something fails

| Symptom | Likely cause |
|---------|--------------|
| Upload fails at step 2 (S3 PUT) | IAM policy, bucket name, or region mismatch |
| `500` on upload request | PostgreSQL not reachable or migration not applied |
| `401` on all API calls | `AUTH_SECRET` changed or session cookie issue |
| Quota not updating | Check PostgreSQL `storageUsed` column after complete step |
| User B sees User A file | Critical bug — do not merge; report immediately |
