import { AsyncQueue, obj_eq, wr, wt } from './lib.mjs';


export class Peer extends EventTarget {


	static ALL_EVENTS = [];
}

const ECDSA = {
	name: "ECDSA",
	namedCurve: "P-256",
	hash: "SHA-256"
};

export default class Antennae extends EventTarget {
	#db;
	#key_pair;

	#pushinfo;
	#queue = new AsyncQueue();

	constructor(db_name = "antennae") {
		super();

		// TODO: Handle changes to indexeddb from other pages / the service worker.

		// Start running once the js stack empties (so that the creator has time to add event listeners)
		queueMicrotask(() => {
			this.#run(db_name)
				// Emit an event for any unhandled errors
				.catch(detail => this.dispatchEvent(new CustomEvent('internal-error', { detail })));
		});
	}

	// State Machines:
	async #run(db_name) {
		this.#db = await wr(indexedDB.open(db_name, 1),
			{
				upgradeneeded({ target: { result: db } }) {
					db.createObjectStore("settings");
					db.createObjectStore('peers', { keyPath: 'public_key' });
				}
			}
		);
		// We don't need to handle the abort or error events on the db because those only happen if an error / abort bubbles up from a request, and we should be listening to those on each request.
		this.#db.addEventListener('versionchange', e => {
			// If a version change is requested, emit an event so that they can close us.
			const ev = new CustomEvent('blocking-db', { detail: e });
			this.dispatchEvent(ev);
		});

		// Load all the settings:
		// TODO: Settings for: JWT subscriber, 
		this.#key_pair = await crypto.subtle.generateKey(ECDSA, false, ['sign', 'verify']);
		await wt(this.#db, 'settings', [
			// Load the pushinfo:
			async settings => this.#pushinfo = await wr(settings.get('pushinfo')),
			// Load the private key (or replace it with the one we've generated):
			async settings => {
				const loaded = await wr(settings.get('key_pair'));
				if (!loaded) {
					await wr(settings.put(this.#key_pair, 'key_pair'));
				} else {
					this.#key_pair = loaded;
				}
			}
		], 'readwrite');

		// Emit the public-key event:
		const pk_buff = await crypto.subtle.exportKey('raw', this.#key_pair.publicKey);
		const pk_ev = new CustomEvent('public-key', { detail: pk_buff });
		this.dispatchEvent(pk_ev);

		// TODO: Handle broadcast messages? (or messages from the service worker), pushinfo, and messages.
		for await (const job of this.#queue) {
			const { set_pushinfo, handle_message, close } = job;
			if (close) {
				// Close the indexedDb connection.
				this.#db.close();
				const ev = new CustomEvent('closed');
				this.dispatchEvent(ev);
				return;
			} else if (set_pushinfo) {
				await wt(this.#db, 'settings', async settings => {
					this.#pushinfo = set_pushinfo;
					await wr(settings.put(this.#pushinfo, 'pushinfo'));
					// TODO: Notify all the peer objects that they will need to send updated push info.
				}, 'readwrite');

				// Does this really need an event?
				let ev = new CustomEvent('log', { detail: "PushInfo has been updated." });
				this.dispatchEvent(ev);
			} else if (handle_message) {
				// TODO: Parse the message and route it around.
			}
			console.log(job);
		}
	}


	// Configuration Interface:
	set_pushinfo(push_info) {
		if (!obj_eq(push_info, this.#pushinfo)) {
			this.#queue.push({ set_pushinfo: push_info });
		}
	}
	// Lifecycle Interface:
	close() {
		this.#queue.push({ close: true });
	}


	// Signaling Interface:
	handle_message(msg) {
		this.#queue.push({ handle_message: msg });
	}
	get_introduction() {

	}


	// Peer Interface:
	get_peer(id) {

	}
	*get_peer_ids() {

	}

	static ALL_EVENTS = ['internal-error', 'log', 'public-key', 'blocking-db', 'closed'];
}