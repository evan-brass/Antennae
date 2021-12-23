// JS values are turned into 32bit numbers before a bitwise operation
// >> is sign preserving
// Unicode is 21 bit so the sign bit of the 32 bit number will always be 0, therefore we can shift without worrying about sign extension.

export class BitBuffer {
	#wbits = 8;
	#waccum = 0;
	#rbits = 0;
	#raccum = 0;
	constructor(buffer = []) {
		this.buffer = buffer;
	}

	push_bits(...bits) {
		for (const bit of bits) {
			this.#waccum = this.#waccum & ((bit ? 1 : 0) << --this.#wbits);
			if (!this.#wbits) {
				this.buffer.push(this.#waccum);
				this.#wbits = 8;
				this.#waccum = 0;
			}
		}
	}
	push_bytes(...bytes) {
		for (const byte of bytes) {
			this.#waccum &= byte >> (8 - this.#wbits);
			this.buffer.push(this.#waccum);
			this.#waccum = (byte << this.#wbits) & 0xFF;
		}
	}
	finalize() {
		if (this.#wbits != 8) {
			this.buffer.push(this.#waccum);
			this.#wbits = 8;
			this.#waccum = 0;
		}
		return this.buffer;
	}
	shift_bit() {
		if (!this.#rbits) {
			if (!this.buffer.length) return undefined;
			this.#raccum = this.buffer.shift();
			this.#rbits = 8;
		}
		return (this.#raccum >> --this.#rbits) & 1;
	}
	shift_byte() {
		if (this.#rbits == 8) {
			// This case will never be hit under normal circumstances because we only fill raccum right before taking from it.
			this.#rbits = 0;
			return this.#raccum;
		} else if (this.#rbits == 0) {
			if (!this.buffer.length) return undefined;
			return this.buffer.shift();
		} else {
			if (!this.buffer.length) return undefined; // There's still bits in the buffer just not enough to read a full byte.
			let ret = this.#raccum << (8 - this.#rbits);
			this.#raccum = this.buffer.shift();
			return ret & (this.#raccum >> this.#rbits);
		}
	}
	log() {
		let ret = this.buffer.map(b => b.toString(2).padStart(8, '0')).join(' ');
		if (this.#bits) {
			if (this.buffer.length) ret += ' ';
			ret += this.#accum.toString(2).padStart(this.#bits, '0');
		}
		return ret;
	}
	// TODO: Finalize by somehow outputting the accumulator?
}

// Functions to encode / decode our big-endian, 3-byte max, variable length unsigned integers.
export function encode_varint(number, bytes) {
	if (number < 0) {
		throw new Error("Our varints are unsigned and thus can't represent negative numbers.");
	}
	if (number > 4198527) {
		throw new Error("Our varints are capped at 3-bytes and this number is not within their representable range.");
	} else if (number > 4223) { // 3-byte
		number -= 4224;
		bytes.push(0b10000000 | (number >> 15));
		bytes.push(0b10000000 | ((number >> 8) & 0b01111111));
		bytes.push(number & 0b11111111);
	} else if (number > 127) { // 2-byte
		number -= 128;
		bytes.push(0b10000000 | (number >> 7));
		bytes.push(number & 0b01111111);
	} else { // 1-byte
		bytes.push(number);
	}
}
export function decode_varint(bytes) {
	let b1 = bytes.shift();
	if (b1 < 128) {
		return b1;
	}
	let accum = (b1 & 0b01111111) << 7;
	let b2 = bytes.shift();
	if (b2 < 128) {
		return (accum | b2) + 128;
	}
	accum = (b2 & 0b01111111 | accum) << 8;
	let b3 = bytes.shift();
	return (accum | b3) + 4224;
}
const dictionary = [ // We have space for 8 dictionary items
	"https://",
	".com",
	".org",
];
export function compress(input) {
	const pieces = [input];
	let i = 0;
	while (i < pieces.length) {
		const piece = pieces[i];
		if (typeof piece == 'string') {
			const substitutions = [];
			// Check for contiguous base10 digits that we can parse and encode as a varint
			let e = /[1-9][0-9]{1,6}/.exec(piece);
			if (e) {
				let { 0: fullMatch, index } = e;
				let int = parseInt(fullMatch);
				if (int > 4198527) {
					fullMatch = fullMatch.substr(0, 6);
					int = parseInt(fullMatch);
				}
				const bytes = [11];
				encode_varint(int, bytes);

				substitutions.push({
					before: piece.substr(0, index),
					replace: bytes,
					after: piece.substr(index + fullMatch.length)
				});
			}
			// Check for dictionary substitutions
			dictionary.forEach((d, di) => {
				const index = piece.indexOf(d);
				if (index !== -1) {
					substitutions.push({
						before: piece.substr(0, index),
					replace: [di + 1],
					after: piece.substr(index + d.length)
					});
				}
			});
			// Check for ipv4 address that we can encode as bytes
			e = /([1-9][0-9]{0,2})\.([1-9][0-9]{0,2})\.([1-9][0-9]{0,2})\.([1-9][0-9]{0,2})/.exec(piece);
			if (e) {
				let { 0: fullMatch, 1: a, 2: b, 3: c, 4: d, index} = e;
				let bytes = ["12", a, b, c, d].map(s => parseInt(s, 10));
				if (bytes.every(v => v < 256)) {
					substitutions.push({
						before: piece.substr(0, index),
						replace: bytes,
						after: piece.substr(index + fullMatch.length)
					});
				}
			}
			// Check for contiguous urlbase64 characters that we can parse into bytes.
			e = /[A-Za-z0-9\-\_]{8,}/.exec(piece);
			if (e) {
				let { 0: fullMatch, index } = e;
				const blocks = Math.min(Math.floor(fullMatch.length / 8), 17);
				fullMatch = fullMatch.substr(0, blocks * 8);
				fullMatch = fullMatch.replaceAll('-', '+');
				fullMatch = fullMatch.replaceAll('_', '/');
				const bstr = atob(fullMatch);
				const bytes = [blocks + 13];
				for (const c of bstr) {
					bytes.push(c.charCodeAt(0));
				}

				substitutions.push({
					before: piece.substr(0, index),
					replace: bytes,
					after: piece.substr(index + fullMatch.length)
				});
			}

			// Find the substitution that reduces the input the most:
			let best_cost, best_sub;
			for (const { before, replace, after } of substitutions) {
				const cost = before.length + replace.length + after.length;
				if (best_cost === undefined || cost < best_cost) {
					best_cost = cost;
					best_sub = [before, replace, after];
				}
			}
			if (best_sub) {
				pieces.splice(i, 1, ...best_sub);
			} else {
				++i;
			}
		} else {
			++i;
		}
	}

	const bytes = [];
	for (const piece of pieces) {
		if (typeof piece == 'string') {
			for (const c of piece) {
				encode_varint(c.codePointAt(0), bytes);
			}
		} else {
			bytes.push(...piece);
		}
	}

	// TODO: Dynamic huffman coding for the bytes.
	const weights = Object.create(null);
	for (const b of bytes) {
		weights[b] = (weights[b] ?? 0) + 1;
	}
	console.log("Weights: ", weights);

	return Uint8Array.from(bytes);
}

export function decompress(buffer) {
	const bytes = Array.from(buffer);
	let output = "";
	while (bytes.length) {
		if (bytes[0] !== 0 && bytes[0] <= 8) {
			const di = bytes.shift();
			output += dictionary[di - 1];
		} else if (bytes[0] == 11) {
			// Digits:
			bytes.shift();
			const int = decode_varint(bytes);
			output += int.toString(10);
		} else if (bytes[0] == 12) {
			bytes.shift();
			output += bytes.shift().toString(10);
			output += '.';
			output += bytes.shift().toString(10);
			output += '.';
			output += bytes.shift().toString(10);
			output += '.';
			output += bytes.shift().toString(10);
		} else if (bytes[0] >= 14 && bytes[0] <= 31) {
			// UrlBase64
			const byte_count = (bytes.shift() - 13) * 6;
			let bstr = "";
			for (let i = 0; i < byte_count; ++i) {
				const byte = bytes.shift();
				bstr += String.fromCharCode(byte);
			}
			let s = btoa(bstr);
			s = s.replaceAll('+', '-');
			s = s.replaceAll('/', '_');
			output += s;
		} else {
			const point = decode_varint(bytes);
			output += String.fromCodePoint(point);
		}
	}
	return output;
}