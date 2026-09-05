security/
│
├── auth/
│ ├── auth.controller.ts
│ ├── auth.service.ts
│ ├── auth.repository.ts
│ ├── auth.routes.ts
│ ├── auth.validation.ts
│ ├── auth.token.ts
│ └── auth.types.ts
│
├── authorization/
│ ├── permission.controller.ts
│ ├── permission.service.ts
│ ├── permission.repository.ts
│ ├── permission.routes.ts
│ ├── permission.validation.ts
│ └── permission.types.ts
│
├── roles/
│ ├── role.controller.ts
│ ├── role.service.ts
│ ├── role.repository.ts
│ ├── role.routes.ts
│ ├── role.validation.ts
│ └── role.types.ts
│
├── middleware/
│ ├── authenticate.middleware.ts
│ └── authorize.middleware.ts
│
└── security.types.ts

┌─────────────────────────────────────────────────────────────┐
│ Permission │
├───────────────────┬─────────────────────────────────────────┤
│ code │ NEWS_CREATE │
│ display_name │ Create News │
│ description │ Allows creation of news articles │
│ module │ NEWS │
│ resource │ ARTICLE │
│ action │ CREATE │
│ display_order │ 10 │
│ is_system_permission │ false │
│ status │ ACTIVE │
└───────────────────┴─────────────────────────────────────────┘

module resource action
------------------------------------------------

NEWS ARTICLE CREATE
NEWS ARTICLE UPDATE
NEWS ARTICLE DELETE
NEWS ARTICLE APPROVE
NEWS ARTICLE PUBLISH

USER USER CREATE
USER USER UPDATE
USER USER DELETE

ROLE ROLE CREATE
ROLE ROLE UPDATE

MEDIA IMAGE UPLOAD
MEDIA IMAGE DELETE

                 SECURITY MODULE
                       │
          ┌────────────┴────────────┐
          │                         │
     Authentication          Authorization
          │                         │
       Login                  Permission
       Register                    │
       Refresh                     │
       Logout                      │
          │                        │
          └──────────┬─────────────┘
                     │
                     ▼
              ANY APPLICATION
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
     NEWS          USERS          MEDIA
       │             │             │
       └─────────────┼─────────────┘
                     ▼
              same authorize()

AUTHENTICATION
│
├── Register
├── Login
├── Logout
├── Refresh Token
├── Get Current User
├── Password Hashing
├── JWT Access Token
├── Refresh Sessions
└── user_roles

AUTHORIZATION
│
├── permissions CRUD
├── roles CRUD
├── role_permissions
├── assign permissions to role
├── assign roles to user
├── authenticate middleware
└── authorize middleware

News
├── NEWS / ARTICLE / CREATE
├── NEWS / ARTICLE / UPDATE
├── NEWS / ARTICLE / APPROVE
└── NEWS / ARTICLE / PUBLISH

Media
├── MEDIA / IMAGE / UPLOAD
└── MEDIA / IMAGE / DELETE

Users
├── USER / USER / CREATE
├── USER / USER / UPDATE
└── USER / USER / DELETE

Authorization flow
------------------

Access Token
↓
authenticate()
↓
req.user.id
↓
user_roles
↓
roles
↓
role_permissions
↓
permissions
↓
module + resource + action
↓
status = ACTIVE?
↓
ALLOW / DENY

---

                         SECURITY MODULE
                               │
              ┌────────────────┴────────────────┐
              │                                 │
        AUTHENTICATION                    AUTHORIZATION
              │                                 │
       ┌──────┼──────┐                    ┌─────┼─────┐
       │      │      │                    │     │     │
    Login  Refresh Logout              Roles Permissions
       │                                 │       │
       │                                 │       │
       └──────────────┐          ┌───────┘       │
                      ▼          ▼               ▼
                         user_roles
                              │
                              ▼
                            roles
                              │
                              ▼
                       role_permissions
                              │
                              ▼
                         permissions
                              │
                  ┌───────────┼───────────┐
                  ▼           ▼           ▼
                module     resource      action
                              │
                              ▼
                       ACTIVE permission?
                              │
                        ┌─────┴─────┐
                        │           │
                       YES          NO
                        │           │
                       ALLOW       DENY

/api/v1/auth
POST /register
POST /login
POST /refresh
POST /logout
GET /me

/api/v1/security/permissions
GET /
GET /:id
POST /
PATCH /:id

    GET    /role/:roleId

    POST   /role/:roleId/:permissionId
    DELETE /role/:roleId/:permissionId

/api/v1/security/roles
GET /
GET /:id
POST /
PATCH /:id

    GET    /user/:userId

    POST   /user/:userId/:roleId
    DELETE /user/:userId/:roleId

request travels:
----------------

Bearer token
↓
authenticate
↓
req.user.id
↓
authorize(
SECURITY,
ROLE,
VIEW
)
↓
user_roles
↓
SUPER_ADMIN
↓
role_permissions
↓
SECURITY_ROLE_VIEW
↓
permission ACTIVE?
↓
YES
↓
controller
---------------------------

security/
│
├── authorization/
│ ├── permission.controller.ts
│ ├── permission.repository.ts
│ ├── permission.routes.ts
│ ├── permission.service.ts
│ ├── permission.types.ts
│ └── permission.validation.ts
│
├── roles/
│ ├── role.controller.ts
│ ├── role.repository.ts
│ ├── role.routes.ts
│ ├── role.service.ts
│ ├── role.types.ts
│ └── role.validation.ts
│
└── middleware/
└── authorize.middleware.ts

authorize(module, resource, action)
↓
permission.repository.userHasPermission()
↓
user_roles
↓
roles
↓
role_permissions
↓
permissions

---

Authentication
│
▼
authenticate
│
▼
authorize("SECURITY", "USER", "VIEW")
│
├── SUPER_ADMIN → ALLOW
│
└── normal user
│
▼
role_permissions
│
▼
permission
│
▼
ALLOW / 403
-----------------------------------

                    SECURITY
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
      USERS           ROLES       PERMISSIONS
        │              │              │
        │              │              │
        └────── USER_ROLE ────────────┘
                       │
                       │
                ROLE_PERMISSION

---

API-side final checklist

1. Authentication — ✅

Register
Login
Refresh token
Logout
/me
Password hashing with bcrypt
Refresh-token session storage/revocation

2. Authentication middleware — ✅

Bearer token validation
Expired/invalid token handling
req.user population

3. Authorization — mostly ✅

authenticate
authorize(module, resource, action)
Permission lookup through:
user_roles → roles → role_permissions → permissions

4. Permissions — review/finalize

Permission CRUD
System-permission protection
Role ↔ permission assignment
Correct DB permission codes
Parameter validation

5. Roles — review/finalize

Role CRUD/update
User ↔ role assignment
Prevent assigning SUPER_ADMIN unless actor is SUPER_ADMIN
Prevent deactivating SUPER_ADMIN
Parameter validation

6. Users — review/finalize

User CRUD
bcrypt password hashing
Required roleId
Role existence/ACTIVE validation
user_roles relationship
Legacy users.role_id compatibility
Prevent self-deactivation/locking
Protect SUPER_ADMIN
Password hash never returned

---

TESTS
-----

Authentication tests — register/login/refresh/logout/me
--------------------

Registration duplicate username → 409
Invalid registration → 400
Valid login → 200
Invalid password → 401
Unknown username → 401
Invalid login payload → 400
Missing access token → 401
Invalid access token → 401
Invalid Authorization header → 401
Invalid refresh token → 401
Logout → 200
Refresh after logout/revocation → 401

Users API tests
---------------

GET /users — list users
GET /users/:id — get user
POST /users — create user
Duplicate username → 409
Duplicate email/mobile → 409
Invalid payload → 400
Invalid role → 404
Inactive role → 400
PATCH /users/:id — update user
Password update
Status update
Self-deactivation protection
SUPER_ADMIN protection
DELETE/deactivate behavior, if your current route exposes it
Authentication required → 401
Permission required → 403
Cleanup of all test users/sessions/roles

Roles API tests
-----------------

Permissions API tests
Authorization/RBAC tests
Security edge-case tests

---

GET /api/v1/roles
unauthenticated → 401
authorized administrator → 200
response contains roles
GET /api/v1/roles/:id
valid role → 200
invalid ID → 400
unknown role → 404
POST /api/v1/roles
create role → 201
duplicate code → 409
duplicate name → 409 if enforced
invalid payload → 400
PATCH /api/v1/roles/:id
update role → 200
invalid ID → 400
unknown role → 404
duplicate code/name → 409
role status handling
activate/deactivate as supported
invalid status → 400
protected roles
prevent unsafe modification/deactivation of SUPER_ADMIN, where applicable
authorization
non-authorized role-management user → 403

Permission Tests:
---------------------

Unauthenticated access → 401
Get all permissions → 200
Get permission by ID → 200
Invalid permission ID → 400
Unknown permission → 404
Create permission → 201
Duplicate permission → 409
Invalid create payload → 400
Invalid permission code → 400
Update permission → 200
Invalid update ID/payload
Role-permission assignment
Duplicate role-permission assignment
Remove role-permission
Invalid/unassigned role-permission cases
Authorization checks for non-authorized users
Cleanup of all temporary test data

RBAC Tests:
-----------

beforeAll
│
├── Create user
├── Create TEST_RBAC_ROLE
├── User → TEST_RBAC_ROLE only
├── TEST_RBAC_ROLE → READ
├── TEST_RBAC_ROLE → CREATE
└── Login
│
▼
RBAC tests
│
├── READ → 200 ✅
├── CREATE → 201 ✅
├── remove CREATE
│ └── CREATE → 403 ✅
├── remove READ
│ └── READ → 403 ✅
├── inactive role
│ └── READ → 403 ✅
├── inactive permission
│ └── READ → 403 ✅
└── restore → 200 ✅

Security API Implementation Test Order:
--------------------------------------

PHASE 1 — Authentication
├── Register
├── Login
├── Refresh
├── Logout
└── Me

PHASE 2 — Users
├── List users
├── Get user
├── Create user
├── Update user
├── Change password
├── Deactivate user
└── Authorization failures

PHASE 3 — Roles
├── List roles
├── Get role
├── Create role
├── Update role
├── Assign role
├── Remove role
└── SUPER_ADMIN protection

PHASE 4 — Permissions
├── List permissions
├── Get permission
├── Create permission
├── Update permission
├── Assign permission to role
└── Remove permission from role

PHASE 5 — Authorization integration
├── No token → 401
├── Invalid token → 401
├── Valid token + no permission → 403
├── Valid permission → success
├── Inactive role → denied
├── Inactive permission → denied
└── SUPER_ADMIN access

---

AUTH TESTS
↓
USERS API TESTS
↓
ROLES API TESTS
↓
PERMISSIONS API TESTS
↓
RBAC / AUTHORIZATION TESTS
↓
FULL SECURITY TEST SUITE

Phase Layer What we'll test
✅ 1 Auth integration Login/authentication flow
✅ 2 Users integration User API
✅ 3 Roles integration Role API
✅ 4 Permissions integration Permission API
✅ 5 RBAC integration Real authorization flow
6 Repository unit tests SQL/data-access methods
7 Service unit tests Business rules
8 Controller unit tests HTTP/controller behavior
9 Middleware unit tests Authentication + authorization
10 Security edge cases Invalid/expired tokens, inactive users, etc.

Unit Tests:
-------------

Role :
------

The Role service has several important rules that deserve explicit tests:

Service layer:
--------------

getAll() delegates correctly.
getById() returns a role.
getById() → 404 when role doesn't exist.
create() succeeds for a new code.
create() → 409 for duplicate role code.
update() succeeds.
update() → 404 for unknown role.
SUPER_ADMIN cannot be made INACTIVE.
SUPER_ADMIN cannot be made SUSPENDED.
Normal roles can be deactivated.
Active role can be assigned.
Unknown role cannot be assigned.
Inactive role cannot be assigned.
Only active SUPER_ADMIN can assign SUPER_ADMIN.
Non-SUPER_ADMIN cannot assign SUPER_ADMIN.
User can remove a role when they have more than one.
Last role cannot be removed.
Role that user doesn't have cannot be removed.
getUserRoles() delegates correctly.

Role Validations:
------------------

createRoleSchema
updateRoleSchema
roleIdSchema
userIdParamSchema
assignRoleSchema
userRoleParamSchema
Valid inputs
Missing required fields
Invalid formats
Boundary values
Invalid status values
Type coercion for IDs
Extra/unknown fields

Permission :
------------

findById
findByCode
findAll
create
update
delete
assignToRole
removeFromRole
findByRoleId
userHasPermission

Auth Tests order:
--------------------

auth.validation.test.ts ← next
auth.token.test.ts
auth.repository.test.ts
auth.service.test.ts
auth.controller.test.ts
auth.routes.test.ts
--------

What this test covers

This gives us coverage for essentially every branch in auth.token.ts:

createAccessToken()
JWT creation
payload
configured expiry
default expiry
missing secret

verifyAccessToken()
valid token
wrong secret
malformed token
expired token
wrong token type
missing sub
invalid username
invalid roles
missing secret

createRefreshToken()
64 random bytes → 128 hex characters
hexadecimal format
uniqueness
hashRefreshToken()
SHA-256 output
deterministic hashing
different inputs produce different hashes

getRefreshTokenExpiry()
configured days
one-day calculation
default 30 days
zero/negative/decimal/invalid configuration

getAccessTokenExpiresIn()
configured value
default 15m

Auth Service Tests:
-------------------

Registration
Successful registration
Duplicate username/email/mobile
Default role missing
Password hashing
Transaction BEGIN / COMMIT / ROLLBACK
User + role assignment
Returned authenticated user

Login
Successful login
Invalid username
Invalid password
Inactive account
Expired password
Failed-login counter update
Successful-login update
Access/refresh token creation
Session creation

Refresh
Valid refresh token
Unknown token
Revoked token
Expired session
Missing user
Inactive user
Token rotation

Logout
Existing session
Unknown session
Session revocation

Current user
Existing user
Missing user

---

Middleware Test Cases:
----------------------

We want isolated unit tests for these cases:

1. No Authorization header
   should throw/forward Authentication required.
2. Malformed Authorization header
   e.g. Basic abc
   should reject with Invalid authorization header.
3. Bearer header without token
   should reject.
4. Invalid JWT
   should reject with Invalid or expired access token.
5. Expired JWT
   should reject.
6. Valid JWT
   should populate req.user
   should call next()
7. Valid JWT with roles
   should preserve id, username, and roles.
8. JWT signed with wrong secret
   should reject.

Authorize Tests:
----------------

Identify all authorization branches:

authenticated user requirement
role handling
module/resource/action matching
denied access
allowed access
multiple roles/permissions
error handling

Your authorize() middleware has four important security paths:

No authenticated user → 401
Active SUPER_ADMIN → immediate access, without checking permissions
Normal user with required permission → access
Normal user without permission → 403
Database/repository errors → forwarded through next(error)
