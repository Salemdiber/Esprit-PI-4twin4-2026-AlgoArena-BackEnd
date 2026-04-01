<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

---

## API Endpoints

Base URL (local): `http://localhost:3000`

Auth: protected routes require header `Authorization: Bearer <access_token>`.

### Health Endpoint

#### `GET /`
- Description: basic hello endpoint.
- Auth: No
- Params: none
- Body: none

### Auth Endpoints

#### `POST /auth/register`
- Description: create a new user account.
- Auth: No
- Body (JSON):
  - `username` (string, required)
  - `password` (string, required, min 6)
  - `email` (string, required, valid email)
  - `avatar` (string URL, optional)
  - `bio` (string, optional)
  - `role` (`Player` | `Admin`, optional)

#### `POST /auth/login`
- Description: authenticate user and return JWT access token.
- Auth: No
- Body (JSON):
  - `username` (string, required)
  - `password` (string, required)

### User Endpoints

#### `POST /user`
- Description: create user directly from user module.
- Auth: No
- Body (JSON): same as `/auth/register`.

#### `GET /user`
- Description: list all users.
- Auth: No
- Params: none
- Body: none

#### `GET /user/:id`
- Description: get one user by id.
- Auth: No
- Path params:
  - `id` (string, required)

#### `PATCH /user/:id`
- Description: update user by id.
- Auth: Yes (JWT)
- Path params:
  - `id` (string, required)
- Body (JSON, all optional):
  - `username` (string)
  - `password` (string)
  - `email` (string)
  - `avatar` (string URL or null)
  - `bio` (string or null)
  - `role` (`Player` | `Admin`)

#### `DELETE /user/:id`
- Description: delete user by id.
- Auth: Yes (JWT)
- Path params:
  - `id` (string, required)

### Account Settings Endpoints (Current User)

#### `GET /user/me`
- Description: load current authenticated user profile (for pre-filling account settings form).
- Auth: Yes (JWT)
- Params: none
- Body: none

#### `PATCH /user/me/avatar`
- Description: upload or replace current user avatar.
- Auth: Yes (JWT)
- Content-Type: `multipart/form-data`
- Form-data fields:
  - `avatar` (file, required)
- File constraints:
  - Allowed: `.jpg`, `.jpeg`, `.png`, `.webp`
  - Max size: 5MB

#### `PATCH /user/me`
- Description: update current user profile information.
- Auth: Yes (JWT)
- Body (JSON, all optional):
  - `username` (string, min 3, max 30)
  - `email` (string, valid email)
  - `bio` (string, max 500)

#### `PATCH /user/me/password`
- Description: change current user password.
- Auth: Yes (JWT)
- Body (JSON):
  - `currentPassword` (string, required, min 6)
  - `newPassword` (string, required, min 6)
  - `confirmPassword` (string, required, min 6)

#### `DELETE /user/me`
- Description: delete current user account.
- Auth: Yes (JWT)
- Body (JSON):
  - `password` (string, required, min 6)
