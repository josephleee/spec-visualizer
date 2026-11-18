# Design Document

## Overview

One daily job at 08:00 reads loans due in two days and sends one message each.

## Components and Interfaces

### ReminderJob

Runs after the nightly backup. Writes `reminder_sent_at` on each loan it reminds, and skips loans that already have one.

### Messenger

Sends a text message through the SMS provider, or an e-mail through the library's mail server.

## Error Handling

A provider that fails leaves `reminder_sent_at` empty, so the next run tries again.
