# Research: Due Date Reminders

## Channel

**Decision**: SMS when the member gave a phone number, email otherwise.

**Rationale**: Nine in ten members signed up with a phone number, and a text is read within minutes. Email costs nothing and covers the rest.

**Alternatives considered**: A messaging app bot (members would have to add a contact first); push notifications (there is no member app to push to); email only (half the members gave no address).

## When to remind

**Decision**: Two days before the due date, at 10:00 local time.

**Rationale**: Two days leaves a weekend day to bring the tool back, and 10:00 is inside the opening hours of both weekdays the library is open.

**Alternatives considered**: The evening before (too late to plan a trip); one week before (forgotten again by the due date).

## Scheduling

**Decision**: An in-process cron schedule in the existing server.

**Rationale**: One job a day does not justify a queue or a second process.

**Alternatives considered**: A system cron entry calling an HTTP route (one more thing to configure on the server); a job queue (nothing else needs one yet).

## Not sending twice

**Decision**: A unique key on member, kind and due date in the `reminders` table; the row is written before the message is sent.

**Rationale**: If the job crashes and restarts, the key refuses the duplicate. A message that was recorded but not sent is retried by a separate sweep.

## Message cost

At the provider's price of 7 cents a text and about 110 reminders a month, the bill is close to 8 euros. Grouping loans per member, as FR-001 asks, is what keeps it under the 10 euro limit.
