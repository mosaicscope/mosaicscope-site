import { h } from "./dom";
import type { Simulation } from "../sim/Simulation";
import type { ModalHost } from "./Modals";
import {
  action,
  workField,
  horseMeet,
  MODS,
  OWNABLE,
  QUALIFIED,
  syncStock,
} from "../sim/Chronicles";
import { HOUR, DAY } from "../sim/Expansion";
import { ENCOUNTERS } from "../content/encounters";
import "./lifephone.css";

type Screen =
  | "Home"
  | "Map"
  | "Calendar"
  | "Farm map"
  | "Campus"
  | "Careers"
  | "Race season"
  | "Garage"
  | "Town hall"
  | "Empire"
  | "Chaos"
  | "People";
type Legacy = "Farm" | "UC" | "Racing" | "Betting" | "Explore";
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-NZ");
export class LifePhone {
  private screen: Screen = "Home";
  private renderedScreen: Screen | null = null;
  private message = "";
  private animal = 0;
  private destination = -1;
  private claim = "The sausage-roll precedent";
  constructor(
    private sim: () => Simulation,
    private modal: ModalHost,
    private legacy: (tab: Legacy) => void,
    private walk: (x: number, y: number) => void,
  ) {}
  private get s() {
    return this.sim().life;
  }
  private get e() {
    return this.sim().expansion;
  }
  private text(t: string) {
    return h("p", { text: t });
  }
  private button(label: string, fn: () => void, disabled = false) {
    return h("button.btn", {
      text: label,
      disabled,
      onclick: () => {
        fn();
        this.show(this.screen);
      },
    });
  }
  private command(label: string, key: string, arg = "", disabled = false) {
    return this.button(
      label,
      () => {
        this.message = action(this.sim(), key, arg);
      },
      disabled,
    );
  }
  private panel(title: string, text: string, buttons: HTMLElement[] = []) {
    return h("article.lp-card", null, [
      h("h3", { text: title }),
      this.text(text),
      h("div.lp-actions", null, buttons),
    ]);
  }
  private openOld(label: string, tab: Legacy) {
    return h("button.btn", { text: label, onclick: () => this.legacy(tab) });
  }
  show(screen: Screen = "Home") {
    const scroll =
      this.renderedScreen === screen
        ? (this.modal.el.querySelector<HTMLElement>(".lifephone")?.scrollTop ??
          0)
        : 0;
    this.screen = screen;
    this.renderedScreen = screen;
    document.querySelector("header.bar.open")?.classList.remove("open");
    document
      .querySelector("header.bar .menu-toggle")
      ?.setAttribute("aria-expanded", "false");
    const screens: Screen[] = [
      "Home",
      "Map",
      "Calendar",
      "Farm map",
      "Campus",
      "Careers",
      "Race season",
      "Garage",
      "Town hall",
      "Empire",
      "Chaos",
      "People",
    ];
    const body =
      screen === "Home"
        ? this.home()
        : screen === "Map"
          ? this.map()
          : screen === "Calendar"
            ? this.calendar()
            : screen === "Farm map"
              ? this.farm()
              : screen === "Campus"
                ? this.campus()
                : screen === "Careers"
                  ? this.careers()
                  : screen === "Race season"
                    ? this.racing()
                    : screen === "Garage"
                      ? this.garage()
                      : screen === "Town hall"
                        ? this.town()
                        : screen === "Empire"
                          ? this.empire()
                          : screen === "People"
                            ? this.people()
                            : this.chaos();
    this.modal.show(
      "Ōtautahi After Dark · " + screen,
      [
        h(
          "nav.lp-nav",
          { "aria-label": "Phone apps" },
          screens.map((t) =>
            this.button(t, () => {
              this.screen = t;
              this.message = "";
            }),
          ),
        ),
        h("p.lp-status", {
          role: "status",
          text: `Day ${Math.floor(this.sim().tick / DAY) + 1} · ${money(this.sim().player.cash)} · ${this.message || "A very normal city. Allegedly."}`,
        }),
        h("div.lp-content", null, body),
      ],
      "lifephone",
    );
    const el = this.modal.el.querySelector<HTMLElement>(".lifephone");
    if (el) el.scrollTop = scroll;
  }
  private home() {
    const s = this.s;
    return [
      this.panel(
        "Your life, one phone",
        `${s.career.role || "Between careers"} · generation ${s.dynasty.generation} · fame ${s.tv.fame} · ${s.politics.mayor ? "Mayor" : "Mayoral support " + s.politics.support}`,
        [
          ...(["Explore", "Betting", "Racing", "Farm", "UC"] as Legacy[]).map(
            (t) => this.openOld(t, t),
          ),
        ],
      ),
      this.panel(
        "Bank",
        `Savings ${money(s.savings)}. Move money between your pocket and savings; both are part of your save.`,
        [
          this.command("Deposit $50", "bank", "50"),
          this.command("Withdraw $50", "bank", "-50"),
        ],
      ),
      this.panel(
        "Town newspaper",
        s.journal.length
          ? s.journal
              .slice(-3)
              .map((j) => j.text)
              .join(" ")
          : "Your story starts with what you do next.",
      ),
      this.panel(
        "Current objective",
        s.scene
          ? `${ENCOUNTERS.find((e) => e.id === s.scene!.id)?.title}: marked near you. Your choice can bring a later callback.`
          : "Explore on foot to meet people and find new scenes.",
        [this.openOld("Resolve nearby scene", "Explore")],
      ),
    ];
  }
  private map() {
    const sim = this.sim(),
      s = this.s;
    const select = h(
      "select",
      {
        "aria-label": "Map destination",
        onchange: (ev: Event) => {
          this.destination = +(ev.target as HTMLSelectElement).value;
        },
      },
      [
        h("option", {
          value: -1,
          text: "Choose a destination",
          selected: this.destination < 0,
        }),
        ...sim.world.buildings.map((b) =>
          h("option", {
            value: b.id,
            text: b.name,
            selected: this.destination === b.id,
          }),
        ),
      ],
    );
    const points = sim.world.buildings
      .filter((_, i) => i % 3 === 0)
      .map((b) =>
        h("button.lp-pin", {
          title: b.name,
          "aria-label": b.name,
          style: `left:${(b.door.x / sim.world.size) * 94}%;top:${(b.door.y / sim.world.size) * 90}%`,
          text: b.kind === "casino" ? "♠" : b.kind === "garage" ? "⚙" : "•",
          onclick: () => {
            this.destination = b.id;
            this.message = b.name;
            this.show("Map");
          },
        }),
      );
    if (s.scene)
      points.push(
        h("span.lp-pin.lp-event", {
          style: `left:${(s.scene.x / sim.world.size) * 94}%;top:${(s.scene.y / sim.world.size) * 90}%`,
          text: "!",
        }),
      );
    points.push(
      h("span.lp-pin.lp-you", {
        style: `left:${(sim.player.x / sim.world.size) * 94}%;top:${(sim.player.y / sim.world.size) * 90}%`,
        text: "●",
      }),
    );
    return [
      h(
        "div.lp-town-map",
        { "aria-label": "Interactive Christchurch map" },
        points,
      ),
      select,
      this.panel(
        "Route planner",
        this.destination >= 0
          ? (sim.world.buildings[this.destination]?.name ??
              "Destination unavailable")
          : "Tap a pin or choose a building. Blue is you; yellow ! is a nearby encounter.",
        [
          h("button.btn", {
            text: "Walk to destination",
            onclick: () => {
              const b = sim.world.buildings[this.destination];
              if (b) {
                this.modal.close();
                this.walk(b.door.x + 0.5, b.door.y + 0.5);
              }
            },
          }),
          ...(["Farm map", "Campus", "Race season"] as Screen[]).map((t) =>
            this.button(t, () => {
              this.screen = t;
            }),
          ),
        ],
      ),
      ...s.markers
        .slice(-8)
        .map((m) =>
          this.panel(
            m.icon + " " + m.name,
            `Landmark at ${Math.round(m.x)}, ${Math.round(m.y)}. Your decisions permanently changed the local story.`,
          ),
        ),
    ];
  }
  private calendar() {
    const sim = this.sim(),
      s = this.s;
    return [
      this.panel(
        "Shared calendar",
        "Race meets, assignments, elections, festivals, court hearings and daily bills use the same game clock. One game hour is about one minute at 1×.",
      ),
      ...s.appointments
        .slice(-20)
        .reverse()
        .map((a) =>
          this.panel(
            a.title,
            `${a.done ? "Due/completed" : "In " + Math.max(0, Math.ceil((a.due - sim.tick) / HOUR)) + " game hours"} · day ${Math.floor(a.due / DAY) + 1}`,
          ),
        ),
      this.panel(
        "Daily commitments",
        `Insurance ${s.insurance.active ? "$10/day" : "off"} · staff $${s.farm.staff * 35}/day · farm overheads depend on stock/equipment. Business and ghost income also settle daily.`,
      ),
    ];
  }
  private farm() {
    const sim = this.sim(),
      s = this.s,
      e = this.e;
    syncStock(sim);
    if (!e.farm)
      return [
        this.panel(
          "Start with a farm",
          "Buy land through Farm supplies, then walk or drive around its paddocks here.",
          [this.openOld("Farm supplies", "Farm")],
        ),
      ];
    const move = (dx: number, dy: number) =>
      this.button(`${dx < 0 ? "←" : dx > 0 ? "→" : dy < 0 ? "↑" : "↓"}`, () => {
        s.farm.x = Math.max(0, Math.min(3, s.farm.x + dx));
        s.farm.y = Math.max(0, Math.min(3, s.farm.y + dy));
      });
    const grid = h(
      "div.lp-farm",
      { "aria-label": "Playable farm paddocks" },
      s.farm.fields.map((f, i) =>
        h("button.lp-field." + f.stage, {
          text: `${s.farm.x === i % 4 && s.farm.y === Math.floor(i / 4) ? (s.farm.ride ? "🚜" : "🧍") : f.stage === "ready" ? "🌾" : f.stage === "sown" ? "🌱" : "🌿"} ${i + 1}\n${f.stage}`,
          "aria-label": `Field ${i + 1}: ${f.stage}`,
          onclick: () => {
            const distance =
              Math.abs(s.farm.x - (i % 4)) +
              Math.abs(s.farm.y - Math.floor(i / 4));
            if (distance <= 1) {
              s.farm.x = i % 4;
              s.farm.y = Math.floor(i / 4);
              this.message = `Field ${i + 1}: soil ${f.soil}, moisture ${f.moisture}, weeds ${f.weeds}.`;
            } else
              this.message =
                "Move to an adjacent paddock; the tractor cannot teleport.";
            this.show("Farm map");
          },
        }),
      ),
    );
    const tools = h(
      "select",
      {
        "aria-label": "Tractor attachment",
        onchange: (ev: Event) => {
          s.farm.tool = (ev.target as HTMLSelectElement).value;
        },
      },
      [
        "Plough",
        "Seed drill",
        "Irrigator",
        "Fertiliser spreader",
        "Sprayer",
        "Combine harvester",
        "Mower",
      ].map((t) =>
        h("option", {
          value: t,
          selected: t === s.farm.tool,
          text: t + (e.machines.includes(t) ? "" : " · not owned"),
        }),
      ),
    );
    const cropSelect = h(
      "select",
      {
        "aria-label": "Field crop",
        onchange: (ev: Event) => {
          const f = s.farm.fields[s.farm.y * 4 + s.farm.x];
          if (f.stage === "grass" || f.stage === "ploughed")
            f.crop = (ev.target as HTMLSelectElement).value;
        },
      },
      ["wheat", "corn", "potatoes"].map((crop) =>
        h("option", {
          value: crop,
          text: crop,
          selected: crop === s.farm.fields[s.farm.y * 4 + s.farm.x].crop,
        }),
      ),
    );
    const stockSelect = h(
      "select",
      {
        "aria-label": "Individual animal",
        onchange: (ev: Event) => {
          this.animal = +(ev.target as HTMLSelectElement).value;
          this.show("Farm map");
        },
      },
      [
        h("option", { value: 0, text: "Choose an animal" }),
        ...s.farm.stock.map((a) =>
          h("option", {
            value: a.id,
            text: a.name,
            selected: this.animal === a.id,
          }),
        ),
      ],
    );
    const a = s.farm.stock.find((a) => a.id === this.animal);
    const out = [
      this.panel(
        "Your Canterbury farm",
        `Position ${s.farm.x + 1},${s.farm.y + 1} · ${s.farm.ride ? "driving tractor" : "on foot"} · ${s.farm.staff} workers. Move onto a paddock, attach equipment, then work the field.`,
        [
          this.openOld("Farm supplies", "Farm"),
          this.button(s.farm.ride ? "Leave tractor" : "Enter tractor", () => {
            if (!e.machines.includes("Tractor")) {
              this.message = "Buy a tractor first.";
              return;
            }
            s.farm.ride = !s.farm.ride;
          }),
        ],
      ),
      grid,
      h("div.lp-dpad", null, [
        move(0, -1),
        move(-1, 0),
        move(1, 0),
        move(0, 1),
      ]),
      h("label", null, ["Attachment", tools]),
      h("label", null, [
        "Crop for this field (choose before sowing)",
        cropSelect,
      ]),
      this.button("Work current field", () => {
        this.message = workField(sim, s.farm.y * 4 + s.farm.x);
      }),
      this.panel(
        "Contracts and staff",
        `Tractor contracts pay every three game hours. Staff care for stock each day and cost $35 each.`,
        [
          this.command("Hire worker · $80", "hire"),
          this.command("Take tractor contract", "contract"),
        ],
      ),
      stockSelect,
    ];
    if (a) {
      out.push(
        h("label", null, [
          "Animal name",
          h("input", {
            "aria-label": "Animal name",
            value: a.name,
            maxlength: 30,
            onchange: (ev: Event) => {
              a.name =
                (ev.target as HTMLInputElement).value.trim().slice(0, 30) ||
                a.name;
            },
          }),
        ]),
        this.panel(
          a.name,
          `${a.species} · age ${a.age} days · health ${a.health} · temperament ${a.temperament} · training ${a.trained} · fame ${a.fame} · parent ${a.parent < 0 ? "founder" : a.parent}`,
          [
            this.command("Groom and train · $5", "animalCare", String(a.id)),
            this.command("Breed · $35", "breed", String(a.id)),
            this.command(
              "Book celebrity appearance",
              "celebrity",
              String(a.id),
            ),
          ],
        ),
      );
    }
    return out;
  }
  private campus() {
    const s = this.s,
      sim = this.sim();
    const rooms = [
      ["Library", "📚"],
      ["Lecture hall", "🎓"],
      ["Student club", "🎸"],
      ["Careers office", "💼"],
      ["Cafe", "☕"],
      ["Town Hall graduation", "🏛️"],
    ];
    return [
      this.panel(
        "Walk around the Ilam campus",
        `Study ${s.campus.study} · club ${s.campus.club || "none"}. Tap a room to visit it. Existing degree tests remain available from Lecture hall.`,
      ),
      h(
        "div.lp-campus",
        null,
        rooms.map(([name, icon], i) =>
          h("button.lp-room", {
            text: `${s.campus.x === i ? "🧍 " : ""}${icon} ${name}`,
            onclick: () => {
              s.campus.x = i;
              if (i === 1 || i === 5) {
                this.legacy("UC");
                return;
              }
              if (i === 3) {
                this.show("Careers");
                return;
              }
              if (i === 0) {
                if (sim.tick - s.campus.lastStudy < HOUR) {
                  this.message = "One library session per game hour.";
                } else {
                  s.campus.lastStudy = sim.tick;
                  s.campus.study++;
                  const a = s.appointments.find(
                    (a) => !a.done && a.kind === "assignment",
                  );
                  if (a) {
                    a.done = true;
                    sim.player.reputation += 2;
                  }
                  this.message =
                    "Study completed. Any open assignment was submitted on time.";
                }
              }
              if (i === 2) {
                s.campus.club = "The Questionable Decisions Society";
                this.message =
                  "Joined the student club. The next faction competition includes you.";
              }
              if (i === 4) {
                if (sim.player.cash >= 5) {
                  sim.player.cash -= 5;
                  sim.player.hunger = Math.min(1, sim.player.hunger + 0.2);
                  this.message = "Coffee and a study-group yarn.";
                } else this.message = "Cafe lunch costs $5.";
              }
              this.show("Campus");
            },
          }),
        ),
      ),
      this.openOld("Open degree courses", "UC"),
      this.panel(
        "Horse Commerce department",
        `${s.horseUni.enrolled ? s.horseUni.credits + "/3 horse credits" : "A suspicious administrative opportunity"}. Question: which asset does a horse most want—carrot, calculator or stapler?`,
        [
          this.command("Enrol your horse · $80", "horseEnrol"),
          ...["carrot", "calculator", "stapler"].map((answer) =>
            this.command(answer, "horseCourse", answer),
          ),
        ],
      ),
    ];
  }
  private careers() {
    return [
      this.panel(
        "Qualifications open doors",
        `Current job: ${this.s.career.role || "none"} · rank ${this.s.career.rank} · ${this.s.career.xp} shifts. Matching completed degrees are checked at interview.`,
        [this.command("Work a shift", "shift")],
      ),
      ...Object.entries(QUALIFIED).map(([degree, job]) =>
        this.panel(
          job,
          `Requires a completed ${degree} qualification. Three shifts earn a promotion; shifts have a three-hour cooldown.`,
          [this.command("Interview for " + job, "interview", job)],
        ),
      ),
    ];
  }
  private racing() {
    const sim = this.sim(),
      s = this.s,
      e = this.e,
      horse = e.horse;
    return [
      this.panel(
        "Horncastle racing season",
        `Season ${s.season.year} · ${s.season.meets}/4 meets · ${s.season.points} points · ${s.season.trophies} trophies · next meet in ${Math.max(0, Math.ceil((s.season.next - sim.tick) / HOUR))} game hours.`,
        [
          this.openOld("Buy / manage horse", "Racing"),
          this.button("Enter scheduled meet · $40", () => {
            this.message = horseMeet(sim);
          }),
        ],
      ),
      this.panel(
        "Training track",
        horse
          ? `${horse.name}: skill ${horse.skill}, fitness ${horse.fitness}. Follow the highlighted training gate; four gates complete a training session.`
          : "Buy a horse first.",
      ),
      horse
        ? h(
            "div.lp-training",
            null,
            [0, 1, 2, 3].map((i) =>
              this.button(
                `${s.season.training % 4 === i ? "▶ " : ""}Gate ${i + 1}`,
                () => {
                  if (s.season.training % 4 !== i) {
                    this.message = "Follow the next highlighted gate.";
                    return;
                  }
                  if (sim.tick - horse.trained < HOUR) {
                    this.message =
                      "Your horse needs a game hour between sessions.";
                    return;
                  }
                  s.season.training++;
                  if (s.season.training % 4 === 0) {
                    horse.skill = Math.min(100, horse.skill + 6);
                    horse.fitness = Math.max(0, horse.fitness - 8);
                    horse.trained = sim.tick;
                    this.message = "Track session complete: +6 skill.";
                  } else this.message = "Gate cleared.";
                },
              ),
            ),
          )
        : h("span"),
      ...s.season.rivals.map((r) =>
        this.panel(
          r.name,
          `${r.points} season points · trainer relationship ${r.trust}`,
          [
            this.button("Share training advice", () => {
              if (!horse || r.trust >= 3) {
                this.message = "Advice exchanged already, or you need a horse.";
                return;
              }
              r.trust++;
              horse.skill = Math.min(100, horse.skill + 1);
              this.message = `${r.name} shared a training tip.`;
            }),
          ],
        ),
      ),
      this.panel(
        "Underground scooter league",
        `Power ${s.scooter.power}/100 · ${s.scooter.wins} derby wins.`,
        [
          this.command("Build scooter · $120", "scooterBuild"),
          this.command("Race the pensioners · $20", "scooterRace"),
        ],
      ),
    ];
  }
  private garage() {
    const sim = this.sim(),
      v = sim.vehicles.find(
        (v) => v.owner === sim.playerId || v.id === sim.player.inCar,
      );
    const out = [
      this.panel(
        "Roadside and insurance",
        `Insurance ${this.s.insurance.active ? "active · $10/day" : "off"}. A damaged owned car is required for claims.`,
        [
          this.command("Insure · $40 joining", "insurance"),
          this.command("Call tow truck · $40", "tow"),
          this.command("Insurance claim · $50 excess", "claim"),
        ],
      ),
    ];
    if (!v)
      return [
        ...out,
        this.panel(
          "Find your wheels",
          "Buy a car or get into one to inspect and modify it.",
        ),
      ];
    out.push(
      this.panel(
        "Vehicle diagnostics",
        `Body ${Math.round(v.damage * 100)}% · engine ${Math.round((v.engineDamage ?? 0) * 100)}% · glass ${Math.round((v.glassDamage ?? 0) * 100)}% · ${v.flatLeft || v.flatRight ? "flat tyres" : "tyres OK"} · heat ${Math.round((v.heat ?? 0) * 100)}%.`,
        [this.command("Repair damaged parts", "repair")],
      ),
      this.panel(
        "Build a monstrous vehicle",
        `Installed: ${(v.lifeMods ?? []).join(", ") || "factory stock"}. Four attachments maximum. Chassis adds mass; tractor engine adds power; racing tyres add grip; double deck raises instability.`,
      ),
      ...MODS.map(([name, cost]) =>
        this.panel(
          name,
          `${money(cost)} · ${(v.lifeMods ?? []).includes(name) ? "installed" : "available"}`,
          [
            this.command(
              "Fit " + name,
              "mod",
              name,
              (v.lifeMods ?? []).includes(name),
            ),
          ],
        ),
      ),
    );
    return out;
  }
  private town() {
    const s = this.s;
    return [
      this.panel(
        "Make Christchurch questionable again",
        `Support ${s.politics.support} + reputation ${Math.round(this.sim().player.reputation)} · ${s.politics.mayor ? "you are mayor" : "win at least 35 combined support"}. Election six game hours after your first campaign.`,
        [
          this.command("Campaign stop · $20", "campaign"),
          this.command("Contest scheduled election", "elect"),
        ],
      ),
      this.panel(
        "City policies",
        `Current: ${s.politics.policy}. Policy spending changes food, nightlife or business economics.`,
        ["Free pies", "Green streets", "Nightlife grants"].map((p) =>
          this.command(p + " · $100", "policy", p),
        ),
      ),
      this.panel(
        "Council versus chicken palace",
        `Heat ${s.council.heat} · hearing stage ${s.council.stage}/3 · ${s.council.permit ? "permitted" : "unpermitted"}. Build illegally to store feed, then deal with inspections.`,
        [
          this.command("Build suspicious shed · $50", "shed"),
          this.command("Get building permit · $100", "permit"),
        ],
      ),
      ...Object.entries(s.factions).map(([name, influence]) =>
        this.panel(
          name,
          `${influence} influence. Win competitions and public support. One faction event per three game hours.`,
          [this.command("Compete for " + name, "faction", name)],
        ),
      ),
      this.panel(
        "Historic monuments",
        "As mayor, rename an owned or selected town building. It changes the real building label and adds a saved landmark.",
        this.sim()
          .world.buildings.slice(0, 5)
          .map((b) => this.command("Rename " + b.name, "rename", String(b.id))),
      ),
    ];
  }
  private empire() {
    const s = this.s,
      sim = this.sim();
    return [
      this.panel(
        "Own the whole bloody town",
        `${s.businesses.length} businesses · daily cash income · rival sabotage can reduce takings.`,
        sim.world.buildings
          .filter(
            (b) =>
              OWNABLE.has(b.kind) && !s.businesses.some((x) => x.id === b.id),
          )
          .slice(0, 8)
          .map((b) =>
            this.command(
              "Buy " + b.name + " · $1,200",
              "buyBusiness",
              String(b.id),
            ),
          ),
      ),
      ...s.businesses.map((b) =>
        this.panel(
          b.name,
          `${b.kind} · level ${b.level} · daily income unlocked.`,
          b.id >= 0
            ? [this.command("Dig tunnel · $300", "tunnel", String(b.id))]
            : [],
        ),
      ),
      this.panel(
        "Bizarre startups",
        "Original fictional businesses with real daily takings.",
        [
          "pigeon hotel",
          "drive-through weddings",
          "support tractor hire",
          "breakup photography",
        ].map((kind) =>
          this.command("Open " + kind + " · $600", "weirdBusiness", kind),
        ),
      ),
      this.panel(
        "Secret underground empire",
        `${s.tunnels.links.length} connections · flood ${s.tunnels.flood}/100 · pump ${s.tunnels.pump ? "working" : "not fitted"}. Two owned connected properties allow underground travel.`,
        [
          this.command("Install flood pump · $100", "pump"),
          ...s.tunnels.links.map((id) =>
            h("button.btn", {
              text: "Travel to " + sim.world.buildings[id]?.name,
              onclick: () => {
                if (s.tunnels.links.length < 2 || s.tunnels.flood > 50) {
                  this.message =
                    "Connect two properties and keep flooding below 50.";
                  this.show("Empire");
                  return;
                }
                const b = sim.world.buildings[id];
                if (b) {
                  const pos = sim.world.nearestWalkable(b.door.x, b.door.y);
                  sim.player.x = sim.player.px = pos.x;
                  sim.player.y = sim.player.py = pos.y;
                  this.message = "Travelled through your private tunnel.";
                  this.show("Empire");
                }
              },
            }),
          ),
        ],
      ),
      this.panel(
        "Paranormal landlord",
        "Inspect an owned property, then restore the ghost’s favourite wallpaper to turn tenant refunds into haunted tourism income.",
        [this.command("Inspect for ghosts · $80", "haunt")],
      ),
      ...s.ghosts.map((g) =>
        this.panel(g.name, `${g.grievance} Trust ${g.trust}/100.`, [
          this.command(
            "Restore wallpaper · $25",
            "ghostPeace",
            String(g.building),
          ),
        ]),
      ),
      this.panel(
        "Your family dynasty",
        `Generation ${s.dynasty.generation} · trust ${money(s.dynasty.trust)} · heirs ${s.dynasty.heirs.map((h) => h.name + " (" + h.age + " story days)").join(", ") || "none"}. Heirs can take over after seven game days.`,
        [
          this.command("Prepare room for an heir · $100", "heir"),
          this.command("Put $50 in family trust", "trust"),
          this.command("Play as next generation", "generation"),
        ],
      ),
    ];
  }
  private chaos() {
    const s = this.s;
    return [
      this.panel(
        "Your personal nemesis",
        `${this.sim().chars[s.nemesis.id]?.name ?? "A rival is watching"} · feud heat ${s.nemesis.heat}. High heat causes periodic sabotage and affects business income.`,
        [
          this.command("Taunt publicly", "taunt"),
          this.command("Offer peace pies · $30", "truce"),
          this.command("Start a town conspiracy", "rumour"),
        ],
      ),
      ...s.rumours.map((r) =>
        this.panel("Town conspiracy", r.text + ` · strength ${r.strength}`),
      ),
      this.panel(
        "Your weird movement",
        `${s.movement.name} · ${s.movement.followers} followers · ${s.movement.schism} schisms · doctrine: ${s.movement.doctrine}. Meetings raise support; larger groups argue over doctrine.`,
        [this.command("Host meeting · $15", "movement")],
      ),
      h("label", null, [
        "Movement name",
        h("input", {
          value: s.movement.name,
          maxlength: 50,
          "aria-label": "Movement name",
          onchange: (ev: Event) => {
            s.movement.name =
              (ev.target as HTMLInputElement).value.trim().slice(0, 50) ||
              s.movement.name;
          },
        }),
      ]),
      this.panel(
        "Flat Out Christchurch",
        `Reality TV · fame ${s.tv.fame} · ${s.tv.episodes} episodes · ${s.tv.signed ? "signed" : "unsigned"}. Feuds and disastrous festivals provide episode material.`,
        [
          this.command(
            s.tv.signed ? "Film next episode" : "Sign TV contract",
            "tv",
          ),
        ],
      ),
      this.panel(
        "Your own dodgy festival",
        `Stage ${s.festival.stage} · ${s.festival.acts} acts · ${s.festival.toilets} toilets · ${s.festival.tickets} tickets. Event begins six game hours after booking.`,
        [
          this.command("Book festival · $150", "festival"),
          this.command("Hire toilet · $30", "toilet"),
          this.command("Book act · $30", "act"),
        ],
      ),
      this.panel(
        "The sausage-roll court",
        s.court
          ? `Against ${s.court.defendant}: ${s.court.claim}. Evidence ${s.court.evidence}; hearing in ${Math.max(0, Math.ceil((s.court.due - this.sim().tick) / HOUR))} hours.`
          : `${s.precedent ? "Your precedent is town history." : "File a case, collect two pieces of evidence and attend the hearing."}`,
        [
          this.command("File ridiculous lawsuit · $40", "case", this.claim),
          this.command("Gather evidence", "evidence"),
          this.command("Attend court hearing", "hearing"),
        ],
      ),
      this.panel(
        "Disaster chains",
        s.chain.active
          ? `Chain stage ${s.chain.step}/4. The next consequence is scheduled.`
          : "An escaped bull can delay a bus, derail a wedding and turn a campaign into local history.",
        [this.command("Let chaos unfold", "cascade")],
      ),
      this.panel(
        "Lasting local history",
        s.markers.map((m) => m.name).join(" · ") ||
          "Your monuments, scandal sites and disaster trails will appear on the map.",
      ),
    ];
  }
  private people() {
    const s = this.s;
    return [
      this.panel(
        "People remember",
        `${s.followups.filter((f) => f.done).length} completed callbacks. Your relationships, businesses, feuds and NPC life chapters persist in save slots.`,
      ),
      ...Object.entries(s.npcs)
        .slice(0, 12)
        .map(([id, n]) =>
          this.panel(
            this.sim().chars[+id]?.name ?? id,
            `${n.job} · ambition: ${n.ambition} · ${n.chapters} daily life chapters. Trust ${this.sim().chars[+id]?.rel.get(this.sim().playerId)?.trust.toFixed(2) ?? "0"}`,
          ),
        ),
      ...s.journal
        .slice(-25)
        .reverse()
        .map((j) =>
          this.panel(`Day ${Math.floor(j.at / DAY) + 1} · ${j.kind}`, j.text),
        ),
    ];
  }
}
