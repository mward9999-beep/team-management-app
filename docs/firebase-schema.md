# Firebase Schema

Use these top-level Cloud Firestore collections for the MVP. Firebase Storage is not used yet.

## users/{uid}

- uid: string
- name: string
- email: string
- activeTeamId: string
- pinnedMessageIds: string[]
- createdAt: timestamp
- updatedAt: timestamp
- lastLoginAt: timestamp

## teams/{teamId}

- name: string
- season: string
- logoUrl: string, optional text URL only
- ownerId: string
- adminIds: string[]
- memberIds: string[], required for security rules
- memberRoles: map of Firebase Auth uid to role key, required for security rules
- createdBy: string
- createdAt: timestamp
- updatedAt: timestamp

Supported role keys in `memberRoles`:

- owner
- manager
- headCoach
- assistantCoach
- parent
- player

## teamMembers/{memberId}

- teamId: string
- userId: string, optional Firebase Auth uid
- name: string
- role: string, for example Coach, Manager, Parent, Player
- accessRole: string, optional role key matching `teams.memberRoles`
- position: string
- status: string
- isOwner: boolean
- profilePhotoUrl: string, optional text URL only

## players/{playerId}

- teamId: string
- memberId: string, optional teamMembers document id
- userId: string, optional Firebase Auth uid
- name: string
- position: string
- jerseyNumber: string or number
- parentEmails: string[]
- parentUserIds: string[]
- pendingParentEmails: string[]
- status: string
- createdAt: timestamp
- createdByUserId: string
- updatedAt: timestamp, optional
- updatedByUserId: string, optional
- lastParentInviteId: string, optional

## schedules/{scheduleId}

- teamId: string
- title: string
- type: string, one of practice, game, tournament, team event, other
- date: string, YYYY-MM-DD
- startTime: string, HH:mm
- endTime: string, HH:mm, optional
- locationName: string
- locationAddress: string
- notes: string
- createdByUserId: string
- createdAt: timestamp
- updatedByUserId: string, optional
- updatedAt: timestamp, optional

Only owners, managers, and head coaches can create, edit, or delete schedule events. Team members can view their own team's events.

## scheduleRsvps/{scheduleId_playerId}

- id: string, same as the document id
- teamId: string
- scheduleId: string
- playerId: string
- userId: string, parent or player Firebase Auth uid that submitted the RSVP
- status: string, one of available, notAvailable, maybe
- note: string, optional
- updatedAt: timestamp

Parents linked in `players/{playerId}.parentUserIds` can RSVP for that player. Players can RSVP for themselves when their uid is stored on `players/{playerId}.userId`. Team members can access RSVP data for their own team.

## messages/{messageId}

- teamId: string
- senderId: string
- senderName: string
- title: string
- body: string
- createdAt: timestamp
- keywords: string[]
- unread: boolean

## pendingInvites/{inviteId}

- teamId: string
- playerId: string
- email: string, normalized lowercase
- role: "parent"
- status: "pending" or "accepted"
- createdAt: timestamp
- createdByUserId: string
- acceptedAt: timestamp, optional
- acceptedByUserId: string, optional

## First Setup Steps

1. Enable Firebase Authentication with Email/Password.
2. Create Cloud Firestore.
3. Paste your Firebase web app config into `firebaseConfig` at the top of `app.js`.
4. Sign up in the app.
5. Use Change Team to create your first team. The app creates the `teams` document, adds your uid to `memberIds`, sets your `memberRoles` entry to `owner`, and creates your owner/admin `teamMembers` document automatically.
6. Use the Schedule screen to add team events, or add optional `messages` documents using the same `teamId`.
7. Use Add Player on the roster to create `players`, link existing parent users by email, or create `pendingInvites` for parents who have not signed up yet.

The app queries `users` by normalized lowercase email with `limit(1)` when linking a parent. Keep user documents minimal and avoid storing private profile details there.
