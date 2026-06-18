process.env.NODE_ENV = "test";
require("dotenv").config({path: ".env.test"});

const request = require("supertest");
const { app, startServer, closeServer } = require("../app");

let server;
let token;
let refreshToken;
let email;

describe("Auth API", () => {
    beforeAll(async () => {
        await startServer();
    });

    describe("Auth API", () => {

        const userData = {
            name: "Will Smith",
            email: "will@example.com",
            password: "Will@fr123",
            acceptTerms: true,
            role: "admin"
        };

        test("REGISTER USER", async () => {
            const res = await request(app)
            .post("/api/auth/register")
            .send(userData);

            expect(res.statusCode).toBe(201);
        });

        test("ACTIVATE USER (TEST MODE)", async () => {
            const res = await request(app)
            .post("/api/auth/check-code")
            .send({
                email: userData.email,
                code: "000000",
                isActive: true
            });

            expect(res.statusCode).toBe(200);
        });

        test("LOGIN USER", async () => {
            const res = await request(app)
            .post("/api/auth/login")
            .send(userData);

            expect(res.statusCode).toBe(200);

            token = res.body.accessToken;
            refreshToken = res.body.refreshToken;
            email = res.body.user.email;
        });

        test("REFRESH TOKEN", async () => {
            const res = await request(app)
            .post("/api/auth/refresh-token")
            .send({ refreshToken });

            expect(res.statusCode).toBe(200);
        });

        test("FORGOT PASSWORD", async () => {
            const res = await request(app)
            .post("/api/auth/forgot-password")
            .send({ email, isActive: false });

            expect(res.statusCode).toBe(200);
        });

        test("RESET PASSWORD", async () => {
            const res = await request(app)
            .post("/api/auth/reset-password")
            .send({
                email,
                newpassword: "NewPass@123"
            });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("userId");
        });
    });


    afterAll(async () => {
        await closeServer();
    });
})