# Design Document

## Overview

A single form on the Desk, three fields, and a card printed on the label printer.

## Components and Interfaces

### MemberForm

Checks the postcode against the library area list and the phone number against existing members.

### CardPrinter

Sends the member number as a barcode to the label printer.

## Data Models

| Field | Type | Note |
|---|---|---|
| number | integer | printed on the card |
| phone | text | unique when given |

## Error Handling

A printer that does not answer leaves the member created and offers "Print again".
