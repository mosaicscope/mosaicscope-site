export interface DebugFlags {
  collision: boolean; hitboxes: boolean; perception: boolean; paths: boolean; grid: boolean; tiers: boolean;
  labels: boolean; social: boolean; events: boolean; velocity: boolean; contacts: boolean;
}
export const DEBUG_LABELS: Record<keyof DebugFlags, string> = {
  collision: "Collision shapes", hitboxes: "Hitboxes", perception: "Perception radii", paths: "Navigation paths", grid: "Spatial grid",
  tiers: "Simulation tiers", labels: "AI state labels", social: "Social links", events: "Event origins", velocity: "Velocity vectors", contacts: "Contact points",
};
export const newDebugFlags = (): DebugFlags => ({ collision: false, hitboxes: false, perception: false, paths: false, grid: false, tiers: false, labels: false, social: false, events: false, velocity: false, contacts: false });

export interface LifeSystemFlags {
  sleepFatigue: boolean;
  dietHunger: boolean;
  injuryRecovery: boolean;
  childhood: boolean;
  budgetBills: boolean;
  savingsInterest: boolean;
  jobSearch: boolean;
  payslips: boolean;
  renting: boolean;
  driverLicence: boolean;
  vehicleCompliance: boolean;
  schoolExams: boolean;
  friendships: boolean;
  birthdaysGifts: boolean;
  councilRatesBins: boolean;
  voting: boolean;
  gymFitness: boolean;
  cooking: boolean;
}

export const LIFE_SYSTEM_LABELS: Record<keyof LifeSystemFlags, string> = {
  sleepFatigue: "Sleep and fatigue",
  dietHunger: "Diet and hunger",
  injuryRecovery: "Injury recovery",
  childhood: "Childhood stages",
  budgetBills: "Budget and bills",
  savingsInterest: "Savings interest",
  jobSearch: "Job search",
  payslips: "Payslips and tax",
  renting: "Renting",
  driverLicence: "Driver licence",
  vehicleCompliance: "WOF and registration",
  schoolExams: "School and exams",
  friendships: "Friendships and gifts",
  birthdaysGifts: "Birthdays",
  councilRatesBins: "Council rates and bins",
  voting: "Voting",
  gymFitness: "Gym and fitness",
  cooking: "Cooking",
};

export const newLifeSystemFlags = (): LifeSystemFlags => ({
  sleepFatigue: true,
  dietHunger: true,
  injuryRecovery: true,
  childhood: true,
  budgetBills: true,
  savingsInterest: true,
  jobSearch: true,
  payslips: true,
  renting: true,
  driverLicence: false,
  vehicleCompliance: true,
  schoolExams: true,
  friendships: true,
  birthdaysGifts: true,
  councilRatesBins: true,
  voting: true,
  gymFitness: true,
  cooking: true,
});
