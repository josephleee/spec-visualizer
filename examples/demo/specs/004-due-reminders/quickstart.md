# Quickstart: Due Date Reminders

How to check this feature by hand once it is built.

## Prepare a loan that is due in two days

```sh
npm run seed -- --member "Test Member" --phone "+31600000000"
npm run seed:loan -- --member "Test Member" --tool "Tile cutter" --due-in 2
```

## Run the daily job with the fake sender

```sh
REMINDER_SENDER=fake npm run reminders:run
```

Expected output:

```text
due_soon  Test Member  sms  "Your Tile cutter is due back on Saturday 16 May."
1 reminder sent, 0 skipped, 0 failed
```

## Run it again

```sh
REMINDER_SENDER=fake npm run reminders:run
```

Nothing is sent the second time: `0 reminders sent, 1 skipped, 0 failed`.

## Turn reminders off and check

Open the link from the message, tap "Stop reminders", create another loan for the same member and run the job once more. The loan appears in the volunteers' list at `/counter/overdue` when it is late, but no message is recorded.

## Message texts to review

| Kind | English | Dutch |
|---|---|---|
| Due soon | Your {tools} is due back on {date}. | Je {tools} moet terug op {date}. |
| Overdue | Your {tools} was due on {date}. Please bring it back this week. | Je {tools} had terug moeten zijn op {date}. Breng je het deze week terug? |
