FROM node:20-alpine

WORKDIR /app

# Kopírujeme package súbory (keďže kontext je zjavne celý niche-cms)
COPY backend/package*.json ./
RUN npm install

# Kopírujeme všetko
COPY . .

# Build widgetu (upravená cesta k skriptu v package.json môže byť potrebná)
RUN npm run build:widget || true 

EXPOSE 3000

ENV NODE_ENV=development

# TOTO JE TA SPRÁVNA CESTA PODĽA TVOJHO LS VÝPISU:
CMD ["node", "backend/api/index.js"]