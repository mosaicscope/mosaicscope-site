# MosaicScope website: your guide

## ✅ Your last 3 jobs (only you can do these)

1. **Make the form email you** (2 min): web3forms.com → enter your email → copy the key from their email → Pages CMS → Basics → *Web3Forms access key* → Save.
2. **Get your domain** (~$30 NZD/yr): buy `mosaicscope.co.nz`, then Cloudflare → Workers & Pages → mosaicscope → Custom domains → add it.
3. **Google Business Profile** (free): business.google.com → "MosaicScope", photographer, Christchurch, add the website link. This is how locals find you on Google Maps.

## 🤫 Easter egg: The Mosaics

A crew lives in the black strip at the very bottom: **Tiles** (main guy), **Glitter** (his girl), and Kodak, Nova, Grain, Ruby, Flash, Lux, Bando and Honey.

- **Music off:** they live their lives (walk, smoke, sit with a beer, selfies, naps, push-ups...).
- **Music on:** they party under the disco ball. Tiles throws cash, the girls hype him, the boys put their hands up, Kodak and Bando spray money guns. Sometimes the cash floats up the page.
- **They react to the site:** open a photo → mock photoshoot with flashing cameras. Build a quote → Tiles counts his cash. Open a FAQ → someone has a think. Send an enquiry → it rains money.
- **The longer people stay, the more it grows:** more of the crew turn up, then a boombox (clickable), string lights, a disco ball, a banner, and an "Our world, coming soon" sign (the hook for the future world page).
- Tap/hover anyone to see their name. Click anyone to play/pause music.

**Their world:** after about 7 minutes a sign appears saying "Our world · step inside". It opens **/world/**, a whole playable stick-figure town where the Mosaics live with hundreds of locals. They fight with toys, gossip, throw parties, hold grudges and make up. It's a separate page, so it never slows down the main site. Details and controls: `game/README.md`. You don't need to do anything to publish it.

**Stats:** https://mosaicscope.pages.dev/api/egg shows visitors who found them, time watched, clicks, music plays, photoshoots, cash throws, boombox clicks, biggest crew and highest level (last 30 days).

## 🔧 Things you can fill in whenever

- **Raw vs edited slider**: Pages CMS → *Raw vs edited* → upload a raw shot + your Lightroom version. The section appears by itself.
- **Pin your best Insta posts first**: Pages CMS → *Instagram posts to pin first* → paste post links.
- **Rates, booking steps, FAQ, quote prices**: all editable in Pages CMS.
- **Next free dates**: Pages CMS → *Next free dates* → add a few (e.g. "Sat 18 Oct"). Leave empty and it says "Ask me".
- **Visitor stats**: Cloudflare → Workers & Pages → mosaicscope → Metrics → Web Analytics.

---

Short steps. Do one at a time.

---

## What's in the folder

| File | What it is | Do you touch it? |
|---|---|---|
| `content.json` | All your words, photos, links | **Yes** (through the editor) |
| `images/` | Your photos and videos go here | **Yes** |
| `index.html`, `styles.css`, `main.js` | The website itself | No |
| `.pages.yml` | Settings for the editor | No |
| `world/` | The Mosaics' world game (built, ready to serve) | No |
| `game/` | Source code for the world game | No |

---

## Part 1: Put it online (one time, about 30 min)

**Cost: free.** You only pay for the domain.

1. **Make a GitHub account** at github.com (free).
2. **New repository** → name it `mosaicscope` → Create.
3. Click **"uploading an existing file"** → drag in everything from this folder → **Commit changes**.
   - Make sure `.pages.yml` uploads too. If you can't see it, turn on hidden files.
4. **Go to Cloudflare** (dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `mosaicscope`.
5. Build settings: **leave everything empty** → **Save and Deploy**.
6. Done. You get a link like `mosaicscope.pages.dev`.

---

## Part 2: Edit without code

1. Go to **app.pagescms.org** → sign in with GitHub.
2. Open `mosaicscope` → **Website content**.
3. Change text, upload photos, add projects → **Save**.
4. The site updates by itself in about a minute.

### Add a real project
1. **Work** → open a placeholder (or **Add**).
2. Fill in **Title**, **Category**, **Cover image**.
3. Optional: more images, a YouTube/Vimeo link, an MP3.
4. **Switch off "Is this a placeholder?"**
5. Save.

### Remove a placeholder
Open it → delete → Save.

### Change the big opening photo
**Basics** → **Big opening photo** → upload → Save.

> Tip: export photos as JPG, about 2000px wide. Big files make the site slow.

---

## Part 3: Make the form send email (5 min)

Right now the form opens the visitor's email app. To make it send straight to you:

1. Go to **web3forms.com** → enter your email → they email you an **access key**.
2. In Pages CMS → **Basics** → paste it into **Web3Forms access key** → Save.
3. Test it: send yourself a message from the live site.

---

## Part 4: Plug in your Instagram (5 min)

1. Go to **behold.so** → sign up (free) → connect Instagram.
2. Make a feed → copy the **JSON feed link**.
3. Pages CMS → **Basics** → paste it into **Behold feed link** → Save.

What happens:
- **"On the light table"** fills with your latest posts.
- Empty **Selected work** slots fill with your Instagram photos too.
- Add a real project and it takes that slot back.
- Don't want that? Switch off **Fill empty work slots with Instagram photos**.

---

## Part 5: Your music (SoundCloud)

1. Make a playlist on SoundCloud with the tracks you want.
2. Copy its link (e.g. `https://soundcloud.com/you/sets/site-vibes`).
3. Pages CMS → **Basics** → paste into **SoundCloud track or playlist link** → Save.

A little record player appears in the corner, and the Sound button plays your picks.

---

## Part 6: YouTube

Already connected to your channel. New uploads show up in the work gallery by themselves (within a few hours).
Want a video from somewhere else? Pages CMS → **Basics** → **Extra YouTube video links** → paste the link → Save.

---

## Part 7: Your own domain

1. Buy `mosaicscope.co.nz`.
2. In Cloudflare → your Pages project → **Custom domains** → add it → follow the steps.
3. Set up email forwarding (Cloudflare **Email Routing**) so `hello@mosaicscope.co.nz` lands in your Gmail.
4. Change **Email for enquiries** in Pages CMS to the new address.

---

## Costs

| Thing | Cost |
|---|---|
| GitHub | Free |
| Cloudflare Pages hosting | Free |
| Pages CMS editor | Free |
| Web3Forms | Free plan |
| Behold | Free plan |
| Domain (.co.nz) | ~$30 NZD/year |

---

## Things only you can give

- [ ] Your real photos and video stills
- [ ] Project titles, years, and who it was for (only real ones)
- [ ] YouTube/Vimeo links for your films
- [ ] A hero photo for the opening screen
- [ ] Your Web3Forms key
- [ ] Your Behold feed link
- [ ] Your domain

---

## Built in, so you don't have to think about it

- Works on phones (heavy effects are toned down).
- If someone has "reduce motion" on, animations stop.
- If a phone can't do 3D, it shows a still image instead.
- Sound is **off** until a visitor turns it on.
- The form never says "sent" unless it really sent.

## Preview on your computer (optional)

Double-clicking `index.html` won't load your content. Use the live link instead, or ask Claude to run a preview.
