export class AsyncQueue {
	#queue = [];
	#waiters = [];
	push(value, t = false) {
		this.#queue.push({ value, t });
		while (this.#waiters.length !== 0) {
			const cb = this.#waiters.shift();
			cb();
		}
	}
	then(cb) {
		this.#waiters.push(cb);
	}
	async next() {
		while (this.#queue.length === 0) await this;
		const {value, t} = this.#queue.shift();
		if (t) throw value;
		return { value, done: false };
	}
	[Symbol.asyncIterator]() { return this; }
}

// A simple and dumb equality function.  Only really works for objects that have the same shape. a must be an object, but b may or may not be.
export function obj_eq(a, b) {
	if (typeof b !== 'object') return false;
	for (const k in a) {
		const t = typeof a[k];
		if (t == 'object') {
			if (!obj_eq(a[k], b[k])) return false;
		} else {
			if (a[k] !== b[k]) return false;
		}
	}
	return true;
}

// Simple helpers for working with indexeddb
export function wr(request, extra = {}) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
		for (const key in extra) {
			request['on' + key] = extra[key];
		}
	});
}
export function wt(db, stores, ops, mode = 'readonly') {
	const transaction = db.transaction(stores, mode);
	if (typeof stores == 'string') stores = [stores];
	if (typeof ops == 'function') ops = [ops];
	return new Promise((resolve, reject) => {
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
		transaction.oncomplete = () => reject(new Error("Transaction completed before ops resolved."));
		stores = stores.map(os => transaction.objectStore(os));
		Promise.all(ops.map(op => op(...stores, transaction)))
			.then(vals => {
				if (vals.length == 1) vals = vals[0];
				transaction.oncomplete = () => resolve(vals);
				transaction.commit();
			})
			.catch(e => {
				transaction.abort();
				throw e;
			});
	});
}