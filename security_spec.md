# Security Specification - Aura Health

## Data Invariants
1. A user can only read and write their own profile (`/users/{userId}`).
2. A user can only read and write their own logs (`/users/{userId}/logs/{date}`).
3. Critical fields like `userId` (if stored inside doc) must match the authenticated UID.
4. Timestamps should be validated where applicable.

## The Dirty Dozen Payloads
1. **Identity Spoofing**: User A trying to update User B's profile.
2. **Shadow Field**: Adding `isAdmin: true` to a user profile.
3. **Ghost Field**: Adding `unauthorized_field: "value"` to a log.
4. **Invalid Mood**: Setting `mood: 100` (beyond 1-5).
5. **Path Poisoning**: Using a 2KB string as a `userId`.
6. **Orphaned Log**: Writing a log to a user that doesn't exist.
7. **Type Mismatch**: Sending `mood: "happy"` instead of integer.
8. **PII Leak**: Authenticated user trying to list ALL users.
9. **Size Attack**: Sending a 1MB string in `gratitude` array.
10. **State Shortcut**: Marking `seedCompleted: true` without a valid seed. (Harder to check in rules, but we can check if it exists).
11. **Email Spoofing**: Accessing admin paths (if any) with an unverified email.
12. **Bulk Delete**: Attempting to delete the entire `logs` collection.

## Test Runner
(I'll focus on the rules logic first as per instructions).
