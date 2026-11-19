# Design Document

## Overview

Two scans make a loan; one scan ends it. The scanner types into a focused text box.

## Architecture Decisions

### Decision 1: The scanner is a keyboard

USB scanners type the code and press Enter. No driver, no special page.

### Decision 2: One box for both scans

The Desk tells a card from a tag by its prefix, so the volunteer never picks a field.
