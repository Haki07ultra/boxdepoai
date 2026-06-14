import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";

// Környezeti változók betöltése (.env fájlból)
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// OpenAI kliens inicializálása
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// A termekek.json beolvasása
let productData = "";
try {
    // Fontos: ékezet nélküli fájlnevet használunk a stabilitás érdekében
    const data = fs.readFileSync("./termekek.json", "utf8");
    productData = data;
} catch (err) {
    console.error("Hiba a termekek.json beolvasásakor:", err);
    productData = "A termékadatok jelenleg nem elérhetőek.";
}

const sessions = {};

// A szigorított System Prompt a kért szállítási és elérhetőségi információkkal
const SYSTEM_PROMPT = `Te a Boxdepo prémium AI asszisztense vagy.

KIZÁRÓLAGOS TÉMAKÖRÖK:
Csak a Boxdepo termékeivel (dobozok, ragasztószalagok, térkitöltők, fóliák) és szolgáltatásaival (szállítás, egyedi gyártás, elérhetőségek, átvételi pont) kapcsolatos kérdésekre válaszolhatsz.

AKTUÁLIS TERMÉKKÍNÁLAT (JSON):
${productData}

SZOLGÁLTATÁSI INFORMÁCIÓK (EZEKET HASZNÁLD):
- Azonnali szállítás készletről: Nincs várakozási idő, folyamatos raktárkészlet.
- Futárszolgálat kompatibilis: Dobozaink úgy válogathatók, amit a futárszolgálat biztosan befogad.
- Egyedi igényekre felkészülten: Minden egy helyen, speciális célra és kivitelben.
- Akár pár darabtól rendelhető: Tetszőlegesen, rendelési minimum nélkül.

ELÉRHETŐSÉGEK ÉS ÁTVÉTELI PONT (HA ERRE KÉRDEZNEK, VAGY AZ ELÉRHETŐSÉGEK GOMBRA KATTINTANAK):
- Telefon: +36 20 537 3248
- E-mail: rendeles@boxdepo.hu
- Boxdepo átvételi pont címe: 8111 Seregélyes, Jánosmajor Iparterület, 3/B épület

MÉRET-ÖSSZEHASONLÍTÁSI LOGIKA (SZIGORÚ):
1. HA VAN PONTOS TALÁLAT: 
   - Ha a keresett méret (pl. 60x60x100) szerepel a listában, AKKOR KIZÁRÓLAG AZT AZ EGYETLEN TERMÉKET MUTASD MEG!
   - Írd le az árát, színét és minden adatát.
   - SZIGORÚAN TILOS ilyenkor bármilyen más "hasonló" terméket ajánlani. Csak a pontosat!

2. HA NAGYOBB/KISEBB MÉRETET KERESNEK:
   - Ha a vásárló egy bizonyos méretnél nagyobbat keres (pl. "60 cm-nél nagyobb doboz"), nézd át a JSON listát.
   - KIZÁRÓLAG azokat a termékeket mutasd meg, amelyek legalább egy dimenziójukban (hossz, szélesség vagy magasság) nagyobbak a megadott értéknél.
   - Ne ajánlj kisebbet, mint amit kértek!

3. HA NINCS PONTOS TALÁLAT:
   - Mondd: "Sajnos pontosan ekkora dobozunk nincs, de találtam néhány nagyon hasonló méretet, ami megfelelő lehet:"
   - Keresd meg a 2-3 legközelebbi méretet a listából a számok alapján.
   - Soha ne ajánlj hatalmas eltérést (pl. 100mm helyett 400mm-t).

SZABÁLYOK:
- ÁRAK: Mindig a JSON-ben szereplő pontos árat mondd.
- VÉGSZÓ: Mindig tedd hozzá: "Az aktuális árakat és a pontos méretválasztékot megtalálja a webshopunkban a megfelelő kategória füle alatt."
- EGYÉNI MÉRET: Ha nincs se pontos, se hasonló, irányítsd az ügyfelet egyedi gyártásra: rendeles@boxdepo.hu | +36 20 537 3248.
- ELÉRHETŐSÉGEK ÉS KAPCSOLAT: Ha a vásárló az elérhetőségekről kérdez, vagy rákattint az Elérhetőségek gombra, add meg neki pontosan a fenti telefonszámot, e-mail címet és a seregélyesi Boxdepo átvételi pont pontos címét!
- KORLÁTOZÁS: Minden más témát (politika, receptek, általános csevegés) háríts el kedvesen.

STÍLUS: **Félkövér** kiemelések, listák, barátságos hangnem, emojik! 📦✨`;

// Chat végpont (API)
app.post("/chat", async (req, res) => {
    try {
        const { message, userId = 'default' } = req.body;
        
        // Munkamenet (history) kezelése
        if (!sessions[userId]) {
            sessions[userId] = { 
                history: [{ role: "system", content: SYSTEM_PROMPT }] 
            };
        }
        
        const userHistory = sessions[userId].history;
        userHistory.push({ role: "user", content: message });

        // OpenAI API hívás
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: userHistory,
            temperature: 0.3,
            presence_penalty: 0.2
        });

        const aiReply = response.choices[0].message.content;
        userHistory.push({ role: "assistant", content: aiReply });

        // Memória limitálása (utolsó 20 üzenet + rendszerüzenet)
        if (userHistory.length > 21) {
            sessions[userId].history = [userHistory[0], ...userHistory.slice(-20)];
        }

        res.json({ reply: aiReply });
    } catch (error) {
        console.error("Szerver hiba:", error);
        res.status(500).json({ reply: "Hiba történt! Keress minket telefonon: +36 20 537 3248 📞" });
    }
});

// Szerver indítása - MÓDOSÍTVA A TÁRHELYHEZ
const PORT = process.env.PORT || 10000; 

// A '0.0.0.0' szükséges ahhoz, hogy a külső világ is elérje a szervert
app.listen(PORT, '0.0.0.0', () => {
    console.log(`-----------------------------------------`);
    console.log(`🚀 Boxdepo Szűrt AI ÉLŐBEN fut...`);
    console.log(`🌍 Elérhető a ${PORT}-os porton keresztül!`);
    console.log(`-----------------------------------------`);
});
