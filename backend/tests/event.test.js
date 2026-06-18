process.env.NODE_ENV = "test";
require("dotenv").config({path: ".env.test"});

const schedule = require('node-schedule');
const request = require("supertest");
const { app, startServer, closeServer } = require("../app");

let server;
let token;
let organizerId;
let eventId;

describe("Events API", () => {
    beforeAll(async () => {
        server = await startServer();
    });

    describe("Test", () => {
        const userData = {
            name: "Will Smith",
            email: "will@example.com",
            password: "Will@fr123",
            acceptTerms: true,
            role: "admin"
        };
        
        test("REGISTER USER", async () => {
            const res = await request(app).post('/api/auth/register').send(userData);

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
            const res = await request(app).post("/api/auth/login").send(userData);
            console.log("LOGIN RESPONSE:", res.body);
            token = res.body.accessToken;
            organizerId = res.body.user.id;

            expect(res.statusCode).toBe(200);
        });

        test("CREATE EVENT", async () => {
            const eventDatas = [{
                organizerId,
                title: "Mariage de William et Gloria",
                description: "Nous avons le plaisir de vous inviter à célébrer notre mariage. Ce sera une journée inoubliable remplie de joie, d'amour et de moments précieux en compagnie de nos proches.",
                eventDate: "2026-06-06",
                banquetTime: "21:30",
                religiousLocation: 'Eglise Saint Pierre',
                religiousTime: '16:00',
                eventCivilLocation: "Hôtel de ville",
                eventLocation: "Djamena",
                maxGuests: 150,
                hasPlusOne: false,
                footRestriction: false,
                showWeddingReligiousLocation: true,
                status: "planned",
                type: "wedding",
                budget: 3000,
                eventNameConcerned1: "William",
                eventNameConcerned2: "Gloria"
            }];
            const eventInvitationNote = {
                invTitle: "Célébrons l'amour",
                mainMessage: "C'est avec un immense bonheur que nous vous ...",
                eventTheme: "Chic et Glamour",
            }
            const data = {
                eventDatas: eventDatas,
                eventInvitationNote: eventInvitationNote
            }
            //console.log("## data:", data);
            const res = await request(app)
            .post("/api/event/create-event")
            .send(data)
            .set("Authorization", `Bearer ${token}`);

            console.log("CREATE EVENT RESPONSE:", res.body);
            eventId = res.body.eventDatas[0].id;
            expect(res.statusCode).toBe(201);
            expect(res.body.eventDatas[0]).toHaveProperty("organizerId");
            expect(res.body.eventDatas[0].organizerId).toBe(1);
        });

        test("GET ALL EVENT", async () => {
            const res = await request(app)
            .get("/api/event/all-events")
            .set("Authorization", `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("result");
            expect(res.body.result.length).toBe(1);
        });

        test("GET ONE EVENT", async () => {
            const res = await request(app)
            .get(`/api/event/${eventId}`)
            .set("Authorization", `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
        });

        test("GET All ORGANIZER EVENT", async () => {
            const res = await request(app)
            .get(`/api/event/organizer/${organizerId}`)
            .set("Authorization", `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("events");
            expect(res.body.events.length).toBe(1);
        });

        test("UPDATE EVENT", async () => {
            const updateData = {
                organizerId,
                eventCivilLocation: "Hôtel de ville",
                eventLocation: "Palais des fêtes de Djamena",
                maxGuests: 151,
                hasPlusOne: true,
                footRestriction: true,
                showWeddingReligiousLocation: false,
            };
            const eventInvitationNote = {
                invTitle: "Célébrons l'amour",
                mainMessage: "C'est avec un immense bonheur que nous vous ...",
                eventTheme: "Chic et Glamour",
            }
            const data = {
                eventDatas: updateData,
                eventInvitationNote: eventInvitationNote
            }
            const res = await request(app)
            .put(`/api/event/${eventId}`)
            .set("Authorization", `Bearer ${token}`)
            .send(data);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("eventDatas");
            expect(res.body.eventDatas.max_guests).toBe(151);

        });

        test("UPDATE STATUS EVENT", async () => {
            const updateData = {
                status: "ACTIVE"
            };
            const res = await request(app)
            .put(`/api/event/status/${eventId}`)
            .set("Authorization", `Bearer ${token}`)
            .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("updatedEvent");
            expect(res.body.updatedEvent.status).toBe("ACTIVE");
        });

        test("DELETE EVENT", async () => {
            const res = await request(app)
            .delete(`/api/event/${eventId}`)
            .set("Authorization", `Bearer ${token}`);
            
            console.log("EVENT RESPONSE:", res.body);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("message");
            expect(res.body.message).toBe(`Evénement ${eventId} supprimé avec succès!`);
        });
    });

    afterAll(async () => {
        await closeServer();
        // Annule tous les jobs en cours pour libérer l'event loop
        const jobs = schedule.scheduledJobs;
        for (let jobName in jobs) {
            jobs[jobName].cancel();
        }
    });
});