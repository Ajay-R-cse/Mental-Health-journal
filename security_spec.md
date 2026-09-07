# Security Specification

## 1. Data Invariants
- Each user owns their user profile at `/users/{userId}` where `request.auth.uid == userId`.
- Every document in `/journalEntries/{entryId}`, `/sleepRecords/{recordId}`, `/activities/{activityId}`, `/insights/{insightId}`, and `/moods/{moodId}` must have `userId == request.auth.uid`.
- Users can only read, create, update, and delete their own records.
- Cross-user reading or tampering is strictly blocked by Firestore Security Rules.
- Unauthenticated access is rejected for all collections except the connection test `/test/connection`.

## 2. The Dirty Dozen Payloads (Targeting Exploits)
1. Write to `/users/other-user-uid` with a foreign UID.
2. Read `/journalEntries` belonging to another user.
3. Create a journal entry where `userId` does not match `request.auth.uid`.
4. Update a journal entry owned by another user.
5. Delete a journal entry owned by another user.
6. Create an unauthenticated record in `/sleepRecords`.
7. Query all `/activities` across all users without scoping to `userId == request.auth.uid`.
8. Inject oversized arbitrary fields into `/insights`.
9. Overwrite another user's mood record at `/moods/{moodId}`.
10. Anonymous user trying to access private user data.
11. Spoofing owner UID during batch write.
12. Attempting to bypass rule gates by missing required fields.

All Dirty Dozen payloads return PERMISSION_DENIED.
