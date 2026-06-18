const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
require('dotenv').config();

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Smart Invite",
            version: "1.0.0",
            description: "Documentation de l'API Smart Invite (Auth + Events + Guests + Invitations)",
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas:{
                AuthRegister: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: {
                            type: "string",
                            example: "user@example.com",
                        },
                        password: {
                            type: "string",
                            minLength: 6,
                            example: "mypassword123"
                        }
                    }
                },
                AuthLogin: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: {
                            type: "string",
                            example: "user@example.com",
                        },
                        password: {
                            type: "string",
                            example: "mypassword123",
                        },
                    },
                },
                AuthResponse: {
                    type: "object",
                    properties: {
                        accessToken: {
                            type: "string",
                            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        },
                    },
                },
                ReqRefresh: {
                    type: "object",
                    properties: {
                        refreshToken: {
                            type: "string",
                            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaW...",
                        }
                    },
                },
                ResRefresh: {
                    type: "object",
                    properties: {
                        accessToken: {
                            type: "string",
                            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ3aWxsaWFtbmRvbmdtbzg5OUBnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NjI3MjQyMDAsImV4cCI6MTc2MjgxMDYwMH0.oCGFOtFjwqR7YFFch5ut0tugMox1G199Di8HJCSRBvU",
                        },
                        refreshToken: {
                            type: "string",
                            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYyNzI0MjAwLCJleHAiOjE3NjMzMjkwMDB9.Y7EEgaK8pXCCg0ptIjCozLpnh3CMpVgKcFqdGVpjXCI",
                        },
                    },
                },
                ReqForgotPass: {
                    type: "object",
                    properties: {
                        email: {
                            type: "string",
                            example: "will@example.com",
                        }
                    },
                },
                ResForgotPass: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            example: "Code de vérification envoyé par email",
                        }
                    },
                },
                ReqCheckCode: {
                    type: "object",
                    properties: {
                        email: {
                            type: "string",
                            example: "will@example.com",
                        },
                        code: {
                            type: "string",
                            example: "404653",
                        }
                    },
                },
                ResCheckCode: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            example: "Code valide",
                        },
                        userId: {
                            type: "number",
                            example: 1,
                        }
                    },
                },
                ReqResetPassword: {
                    type: "object",
                    properties: {
                        email: {
                            type: "string",
                            example: "will@example.com",
                        },
                        newpassword: {
                            type: "string",
                            example: "newpassword123",
                        }
                    },
                },
                ResResetPassword: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            example: "Mot de passe réinitialisé avec succès",
                        },
                        userId: {
                            type: "number",
                            example: 1,
                        }
                    },
                },
                MeResponse: {
                type: "object",
                    properties: {
                        id: {
                            type: "integer",
                            example: 1,
                        },
                        name: {
                            type: "string",
                            example: "will",
                        },
                        email: {
                            type: "string",
                            example: "will@example.com",
                        },
                    },
                },
                ReqDataEvent: {
                    type: "object",
                    properties: {
                        organizerId: {
                            type: "number",
                            example: 1,
                        },
                        title: {
                            type: "string",
                            example: "Mariage de William et Gloria"
                        },
                        description: {
                            type: "string",
                            example: "Nous avons le plaisir de vous inviter à célébrer notre mariage. Ce sera une journée inoubliable remplie de joie, d'amour et de moments précieux en compagnie de nos proches."
                        },
                        eventDate: {
                            type: "string",
                            example: "2026-06-06"
                        },
                        eventLocation: {
                            type: "string",
                            example: "Djamena"
                        },
                        maxGuests: {
                            type: "number",
                            example: 150
                        },
                        hasPlusOne: {
                            type: "boolean",
                            example: false
                        },
                        footRestriction: {
                            type: "boolean",
                            example: false
                        },
                        status: {
                            type: "string",
                            example: "PLANNED"
                        },
                    }
                },
                ResDataEvent: {
                    type: "object",
                    properties: {
                        id: {
                            type: "number",
                            example: 1,
                        },
                        organizerId: {
                            type: "number",
                            example: 1,
                        },
                        title: {
                            type: "string",
                            example: "Mariage de William et Gloria"
                        },
                        description: {
                            type: "string",
                            example: "Nous avons le plaisir de vous inviter à célébrer notre mariage. Ce sera une journée inoubliable remplie de joie, d'amour et de moments précieux en compagnie de nos proches."
                        },
                        eventDate: {
                            type: "string",
                            example: "2026-06-06"
                        },
                        eventLocation: {
                            type: "string",
                            example: "Djamena"
                        },
                        maxGuests: {
                            type: "number",
                            example: 150
                        },
                        hasPlusOne: {
                            type: "boolean",
                            example: false
                        },
                        footRestriction: {
                            type: "boolean",
                            example: false
                        },
                        status: {
                            type: "string",
                            example: "PLANNED"
                        },
                    }
                },
                ReqStatusEvent: {
                    type: "object",
                    properties: {
                        status: {
                            type: "string",
                            example: "ACTIVE"
                        }
                    }
                },
            }
        }
    },
    apis: ["./backend/routes/*.js"],
};

const swaggerDocument = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log("#: Swagger docs:" + process.env.BASE_URL +process.env.PORT+"/api-docs");
}

module.exports = setupSwagger;