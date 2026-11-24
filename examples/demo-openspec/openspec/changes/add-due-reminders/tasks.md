# Tasks

## 1. Reminder job

- [x] 1.1 Add `reminder_sent_at` to loans
- [x] 1.2 Schedule the daily job at 08:00
  - after the backup, never before 07:00
- [ ] 1.3 Send by text message or e-mail, whichever the member gave
  - [x] 1.3.1 Message template with tool name and due date
  - [ ] 1.3.2 SMS provider client
- [ ] 1.4 Check: a rerun of the job sends nothing twice

## 2. Member settings

- [ ] 2.1 Add the reminders switch to the account page
- [ ] 2.2 Check: a member with reminders off gets nothing

## 3. Counter

- [~] 3.1 Move the overdue list to the counter page
