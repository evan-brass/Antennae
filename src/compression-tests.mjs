import { compress, decompress, BitBuffer } from "./compress.mjs";

const encoder = new TextEncoder();

function test(input_string) {
	const baseline = encoder.encode(input_string);
	const compressed = compress(input_string);
	const output = decompress(compressed);
	const ratio = compressed.length / baseline.length;
	const same = output === input_string;

	console.log("Compressed: ", ratio, compressed.length);
	if (!same) {
		console.error("Compression / decompression failed on input (input, ouput): ", input_string, output);
	}
}

test("Hello World");
test("192.168.1.1");
test("https://fcm.googleapis.com/fcm/send/f-ieIRgYEcM:APA91bGW0YqWiDwY2IXBZ5S4ewLnulX82N3FE0eq5CHXorqWDp5w9adDSrLH6bo1E8Rhigo-uKw-BLaVUUpxfwEJ2RavZOtjXAPqacgURP_ZxihYuEc9XOUIjS40M0oTpdDUG48wroBV");
test("😁😊🤩");
test("12345678");
test("52345678");
test("0000454");
test("1");
test("128");
test("1542");
test("999");
test(`Linguistics and dictionaries:

ði ıntəˈnæʃənəl fəˈnɛtık əsoʊsiˈeıʃn
Y [ˈʏpsilɔn], Yen [jɛn], Yoga [ˈjoːgɑ]`);

test(`
From a speech of Demosthenes in the 4th century BC:

Οὐχὶ ταὐτὰ παρίσταταί μοι γιγνώσκειν, ὦ ἄνδρες ᾿Αθηναῖοι,
ὅταν τ᾿ εἰς τὰ πράγματα ἀποβλέψω καὶ ὅταν πρὸς τοὺς
λόγους οὓς ἀκούω· τοὺς μὲν γὰρ λόγους περὶ τοῦ
τιμωρήσασθαι Φίλιππον ὁρῶ γιγνομένους, τὰ δὲ πράγματ᾿ 
εἰς τοῦτο προήκοντα,  ὥσθ᾿ ὅπως μὴ πεισόμεθ᾿ αὐτοὶ
πρότερον κακῶς σκέψασθαι δέον. οὐδέν οὖν ἄλλο μοι δοκοῦσιν`);

test(`Georgian:

From a Unicode conference invitation:

გთხოვთ ახლავე გაიაროთ რეგისტრაცია Unicode-ის მეათე საერთაშორისო
კონფერენციაზე დასასწრებად, რომელიც გაიმართება 10-12 მარტს,
ქ. მაინცში, გერმანიაში. კონფერენცია შეჰკრებს ერთად მსოფლიოს
ექსპერტებს ისეთ დარგებში როგორიცაა ინტერნეტი და Unicode-ი,
ინტერნაციონალიზაცია და ლოკალიზაცია, Unicode-ის გამოყენება
ოპერაციულ სისტემებსა, და გამოყენებით პროგრამებში, შრიფტებში,
ტექსტების დამუშავებასა და მრავალენოვან კომპიუტერულ სისტემებში.`);

test(`evan.brass@pm.me`);
test('brassevan@gmail.com');
test('https://Dark.net/EAB:HK/lksdjf');
test('{"something": "more", like: 5, "json": {}');

function test_bitbuffer(args, test_log) {
	let buf = new BitBuffer();
	for (const v of args) {
		if (typeof v == 'number') {
			buf.write_byte(v);
		} else {
			for (const b of v) {
				buf.write_bit(b);
			}
		}
	}
	const log = buf.log();
	console.assert(log == test_log);
}
test_bitbuffer([[1, 0, 0, 1, 0, 1, 1]], '1001011');
test_bitbuffer([
	[0, 1],
	4,
	[1, 1, 1]
], '01000001 00111');