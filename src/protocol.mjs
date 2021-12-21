/// # The Signaling Protocol
/// This signaling protocol is interesting in that it must fit within the 4kb size limit imposed by the WebPush protocol.  Web Push can send a maximum of 4094 bytes, however in my experience, those bytes must be valid text.  In Chrome (and I think FireFox) if the push message includes invalid characters then the push event's data will be empty.  I don't however know exactly what characters are allowed.  I assume it would allow json but to be safe I'm sticking to urlbase64.  This means we can have a maximum 3070 bytes per message before encoding into base64.  Every message needs at least one recoverable signature to identify which peer sent the message so we apply the message to the proper WebRTCPeerConnection.  We use recoverable signatures which are 64 bytes (1 + 31 + 32 bits).  Additionally, each push authorization (a Json Web Token) needs a signature.  To make the first contact message as small as possible, we use one signature to both sign the message and the JWT.  The goal is to make that introduction small enough that it can fit in a URL even after being base64 encoded.
/// A mini introduction consists of all the information required to send the peer a push notification.  We can then send them our own introduction with the information required to send us push messages.  With that out of the way, we can start pushing eachother WebRTC messages.  Thus an introduction consists of: at least one JWT authorization (for mini introductions the expiration date is implied: it is the closest 24 hour boundary and isn't fuzzed with the peer's public key because we don't know what their public key is yet.), pushinfo (a 16 byte salt, 65bit public ECDH key, and the endpoint URL), and a subscriber (which defaults to no-reply@example.com if it isn't supplied).  Sadly, perhaps the largest portion of the message will be text (the endpoint url for mini introductions and sdp / ice for signaling messages.)  In fact, I've seen > 3kb WebRTC sdp / ice messages.  To make this work then, we end up needing to compress these strings.  Alternatively we could maybe use a binary format to represent the ice / sdp messages, but that could stop working in the future.
/// Lastly, all messages start with a single header byte.  For introduction messages, this header is used to determine the msb of the ECDH key.  All message signatures are required to be low-s, and the y field is packed into the msb of the s field.  JWT auth signatures are not required to be low-s unless the signature is doubling as the message signature (as in the mini introduction) in which case it does need to be.
/// The signaling protocol is written in Rust for two reasons: 1. The Rust ecosystem has great libraries for handling parsing, compression, base64, etc.  2. By not being in an interpreted language, the protocol could be used by desktop or embedded applications in the future.
/// The aplication server key doubles as the peer's identity.
// P-256 is possibly backdoored based on NSA behavior so you should have an additional layer of encryption on top of this peer layer.  

/**
 * Encoding Budget: 3070 bytes ((4096[4kb WebPush limit] - 2[padding count]) * 5/8[base64 efficiency])
 * - header (1): 3069
 * - signature (64): 3005
 * 
 * Fixed size data:
 * 1. Auth Salt (16)
 * 2. p256dh compressed (32 + 1bit)
 * 3. Auth expiration base (4)
 * 4. Auth Signatures (64)
 * 
 * Strings (null separated, almost always compressed together)
 * a. Auth Endpoint
 * b. Auth Subscriber
 * c. SDP Offer / Answer
 * d. ICE Candidates
 */

/**
 * Header Codes:
 *  0 - Reserved
 *  1 - MiniIntro: [1, 2h, a, b?]
 *  2 - MiniIntro: [1, 2l, a, b?]
 *  3 - StdIntro: [1, 2h, 3, 4, 4, 4, 4, a, b, d*]
 *  4 - StdIntro: [1, 2l, 3, 4, 4, 4, 4, a, b, d*]
 *  5 - OfferIntro: [1, 2h, 3, 4, 4, 4, 4, a, b, co, d*]
 *  6 - OfferIntro: [1, 2l, 3, 4, 4, 4, 4, a, b, co, d*]
 *  7 - AnswerIntro: [1, 2h, 3, 4, 4, 4, 4, a, b, ca, d*]
 *  8 - AnswerIntro: [1, 2l, 3, 4, 4, 4, 4, a, b, ca, d*]
 *  9 - Offer: [co, d*]
 * 10 - Answer: [ca, d*]
 * 11 - JustIce: [d+]
 * 12 - JustAuth: [3, b, 4+] // NOTE: The order of these components is different (b before 4)! And the Auth subscriber (b) is not compressed!
 * Rest - Reserved
 */

/**
 * String Compression:
 * While I could probably get away with using a subset of utf8, I don't want to encounter problems later.  So the current plan is to:
 * concatonate strings with null bytes between -> encode into utf8 bytes -> use modes to pre compress the bytes -> lzw or deflate or something.
 * The modes are just little ways of recognizing text patterns or fragments and turning them into a binary representation.  We'll encode these modes into a signal byte followed by a number of data bytes.  The signal bytes will be picked from the utf8 / ascii control characters.  The current planned "modes":
 * - "https://"
 * - ".com"
 * - ".org"
 * - digit mode (contiguous base10 digits): eg. "12345"  Probably represented by a 4byte integer (not sure if it should be signed or not)
 * - base64 mode (contiguous urlbase64 characters): eg, "aGVsbG8gd29ybGQ="
 * - ipv4 mode (an ipv4 address)
 * I'll need to look at SDP and ICE candidates to see what other modes might be able to reduce their size.
 */

export function encode_message() {
	// Budget


}

export function decode_message() {

}