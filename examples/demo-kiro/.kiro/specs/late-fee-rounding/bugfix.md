# Bugfix Requirements Document

## Introduction

A member who returned a drill 26 hours late was charged for three days. Fees are counted from midnight instead of from the due time.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a tool is returned 26 hours after its due time THEN the system charges three late days

1.2 WHEN a tool is returned at 00:10 on the day after its due date THEN the system charges one late day for ten minutes

### Expected Behavior (Correct)

2.1 WHEN a tool is returned 26 hours after its due time THEN the system SHALL charge two late days

2.2 WHEN a tool is returned within one hour of its due time THEN the system SHALL charge nothing

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a tool is returned before its due time THEN the system SHALL CONTINUE TO charge nothing

3.2 WHEN a fee is shown THEN the system SHALL CONTINUE TO round it up to whole days
