# CCK Groups -- Development Plan

## Overview

CCK Groups is a system that generates and manages competition group
assignments for Cubing Club Korea competitions.

Two user types exist: - **General users** - **Administrators**

General users can browse competitions and see group assignments.\
Administrators can generate, edit, and publish group assignments.

The system integrates with existing APIs:

-   **CCK Payment API**
    -   competition list
    -   registered competitors
    -   event registrations
    -   CCKID
-   **CCK Ranking API**
    -   competitor results
    -   add competitors to round pages

------------------------------------------------------------------------

# Tech Stack

## Frontend

-   React
-   TypeScript
-   Vite
-   SWC

Recommended libraries: - React Router - TanStack Query - Zustand (or
Redux)

## Backend

Recommended: **Spring Boot**

Reasons: - other CCK services already use Spring - easy integration with
Payment / Ranking APIs

## Database

-   PostgreSQL or MySQL

------------------------------------------------------------------------

# System Architecture

Frontend (React)\
↓ REST API

Backend (Spring Boot)

-   Payment API integration
-   Ranking API integration
-   Grouping algorithm

↓

Database (group assignments)

------------------------------------------------------------------------

# User Features

## Competition List

Route

/competitions

Shows: - competition name - date - location

Data source: **Payment API**

## Competition Detail

Route

/competition/:competitionId

Shows: - competitor list - search function

Click competitor → competitor page

## Competitor Page

Route

/competitor/:cckId

Shows competitor's assignments

Example

3x3 Round 1 -- Competitor (Group B)

3x3 Round 1 -- Judge

2x2 Round 1 -- Runner

------------------------------------------------------------------------

# Admin System

Admin login required.

Admin users can: - use normal user features - access admin panel

Route

/admin

------------------------------------------------------------------------

# Admin Pages

## Competition Management

/admin/competitions

Shows competitions admin can manage.

## Grouping List

/admin/competition/:id/groupings

Shows: - existing groupings - create new grouping - edit grouping

------------------------------------------------------------------------

# Grouping Creation Flow

Grouping consists of **4 steps**

------------------------------------------------------------------------

# Step 1 -- Round Setup

Admin defines groups per round.

Example table:

Event \| Round \| Total Competitors \| Groups \| Competitors per group

3x3 \| R1 \| 120 \| 6 \| 20

Admin configures per group:

-   competitor count
-   judge count
-   runner count
-   scrambler count

System calculates total staff required.

------------------------------------------------------------------------

# Step 2 -- Staff Eligibility

Admin selects:

## Organizers

People that should avoid normal duties.

## Scrambler Pool

Only skilled cubers should scramble.

Example

Scrambler Pool

-   CCKID 1001
-   CCKID 1042
-   CCKID 1130

------------------------------------------------------------------------

# Step 3 -- Automatic Group Assignment

Roles

-   competitor
-   judge
-   runner
-   scrambler

## Constraints

### Rule 1

A person cannot have multiple roles in the same group.

Example

❌ competitor + judge\
❌ judge + runner

### Rule 2

Staff roles only assigned to events the person competes in.

### Rule 3

Avoid consecutive staff roles.

### Rule 4

Each competitor competes once per event per round.

------------------------------------------------------------------------

# Suggested Algorithm

1.  Load competitor list
2.  Shuffle competitors
3.  Split competitors into groups
4.  Assign competitors
5.  Assign scramblers
6.  Assign judges
7.  Assign runners
8.  Balance workload

This is essentially a **constraint satisfaction problem**.

------------------------------------------------------------------------

# Step 4 -- Result Review

Two views supported

## Group View

Example

3x3 Round 1

Group A

Competitors - A - B - C

Judges - D - E

Runner - F

Scrambler - G

## Competitor View

Example

Player: John Doe

3x3 -- Group B (Competitor)

3x3 -- Group A (Judge)

2x2 -- Group C (Runner)

------------------------------------------------------------------------

# Publishing

When admin clicks **Publish**

-   grouping saved to database
-   visible to all users

Optional

Push results to **CCK Ranking API**

------------------------------------------------------------------------

# Database Structure (Example)

## competitions

id\
name\
date\
location

## groupings

id\
competition_id\
created_at\
published

## groups

id\
grouping_id\
event\
round\
group_number

## assignments

id\
group_id\
cck_id\
role

Roles

-   competitor
-   judge
-   runner
-   scrambler

------------------------------------------------------------------------

# API Design

## Public

GET /competitions

GET /competition/{id}

GET /competitor/{cckId}

## Admin

GET /admin/competitions

POST /admin/grouping/create

POST /admin/grouping/generate

POST /admin/grouping/publish

PUT /admin/grouping/update

------------------------------------------------------------------------

# Frontend Routes

/competitions

/competition/:id

/competitor/:cckId

/admin

/admin/competition/:id

/admin/grouping/:id

------------------------------------------------------------------------

# Future Improvements

-   fairness optimization
-   scramble difficulty filtering
-   schedule simulation
-   WCA-style balancing
-   PDF export
-   CSV export

------------------------------------------------------------------------

# Key Technical Challenge

The hardest component is the **group generation algorithm**.

It must

-   satisfy constraints
-   distribute staff fairly
-   prevent overload
-   support multiple events

Recommended approaches

-   greedy algorithm with scoring
-   constraint solver
