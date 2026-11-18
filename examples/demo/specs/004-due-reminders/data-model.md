# Data Model: Due Date Reminders

## Entities

### Reminder

One message sent, or about to be sent, to one member.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| member_id | uuid | references Member |
| kind | enum | `due_soon`, `overdue` |
| due_date | date | the due date the message is about |
| channel | enum | `sms`, `email` |
| status | enum | `pending`, `sent`, `failed` |
| sent_at | timestamptz | nullable |

Unique on (`member_id`, `kind`, `due_date`).

### Reminder Preference

| Field | Type | Notes |
|---|---|---|
| member_id | uuid | primary key, references Member |
| enabled | boolean | default `true` |
| changed_at | timestamptz | |

## Relationships

- A Reminder covers every loan of one member that shares its due date.
- A Reminder Preference belongs to exactly one Member; no row means reminders are on.

## State Transitions

```text
pending ──► sent
   │
   └──► failed ──► pending   (retried up to 3 times by the sweep)
```
