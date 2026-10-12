/**
 * Authored conversation exchanges: a short back-and-forth written as a unit, so every reply actually
 * answers the line before it. Speaker A opens; lines then alternate A, B, A, B.
 *
 * The engine picks an exchange whose tags ALL hold for the pair right now (time, weather, place,
 * roles, moods, relationship, recent events), preferring the most specific match, never repeating
 * an exchange the same pair has already had, and paces each line by how long it takes to read.
 *
 * Tags (all optional; every listed tag must be true):
 *   time:      morning (5-11) | day (11-17) | evening (17-21) | night (21-24) | late (0-5)
 *   weather:   rain | storm | clear
 *   place:     @street @plaza @park @court @studio @stage @market @playground @alley @casino @police
 *              @food @shops @residential @office @dealership @hospital @gallery @airport
 *   relation:  friends | strangers | rivals | couple | crush      (how A feels about B)
 *   roles:     a:<role> / b:<role>, roles = local student barista chef vendor shopkeeper cop thief
 *              graffiti cleaner dealer bouncer busker skater car_enthusiast office tourist mechanic
 *              musician photographer medic taxi driver gambler mobster smuggler comic mogul model vigilante
 *              villain skibunny zookeeper, plus a:mosaic / b:mosaic (the crew)
 *   mood (A or B): a:happy a:sad a:angry a:scared a:tired a:hungry a:bored a:broke a:rich a:hurt
 *              (same with b:)
 *   events nearby in the last few minutes: after:crime after:arrest after:crash after:fight
 *              after:graffiti after:kiss after:shoot after:collapse after:casino_win after:party
 *   other:     party (a party is on) | wanted (the player is wanted and close) | b:player (B is the player)
 *
 * Placeholders: {a} {b} first names of A and B, {place} area name, {item} what A is holding,
 *   {who} the person involved in the recent event, {handle} @mosaicscope, {rate} cheapest shoot price,
 *   {post} first line of a real recent Instagram caption (only use in exchanges tagged "post").
 */
export type Tag = string;
export interface Exchange {
  id: string;
  tags: Tag[];
  lines: string[];
  w?: number;
}
