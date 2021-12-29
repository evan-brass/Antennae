// A transcoding of Vitter's Algorithm 673 which was written in Pascal

export function encode_vitter(message) {
	let output = "";

	const rep = [], alpha = [];
	let M = 0, R = -1, E = 0, n = 256, Z = 2 * n - 1;
	for (let i = 1; i <= n; ++i) {
		M += 1;
		R += 1;
		if (2 * R == M) {
			E += 1;
			R = 0;
		}
		alpha[i] = i;
		rep[i] = i;
	}

	const block = [];
	// Create a single block for the 0-node which starts as node[n]
	const _firstBlock = {
		weight: 0,
		parity: 0,
		parent: 0,
		rtChild: 0, // This isn't usually initialized...
		first: n,
		last: n,
		nextBlock: null,
		prevBlock: null
	};
	_firstBlock.nextBlock = _firstBlock;
	_firstBlock.prevBlock = _firstBlock;
	block[n] = _firstBlock;

	let root; // Root is set in EncodeAndTransmit

	function FindChild(j, parity) {
		const jb = block[j];
		let delta = 2 * (jb.first - j) + 1 - parity;
		let right = jb.rtChild, gap = right - block[right].last;
		if (delta <= gap) return right - delta;
		else {
			delta = delta - gap - 1;
			right = block[right].prevBlock.first; gap = right-block[right].last;
			if (delta <= gap) return right - delta;
			else return block[right].prevBlock.first - delta + gap + 1;
		}
	}

	function EncodeAndTransmit(k) {
		const stack = [];
		let q = rep[k];
		let t;
		let i = 0;

		if (q <= M) { // Encode letter of 0 weight
			q = q - 1;
			if (q < 2 * R) {
				t = E + 1;
			} else {
				q = q - R;
				t = E;
			}
			for (let _ = 1; _ <= t; ++_) {
				i = i + 1;
				stack[i] = q % 2;
				q = Math.trunc(q / 2); // Does this need a Math.trunc?
			}
			q = M;
		}
		if (M == n) root = n; else root = Z;
		// Traverse up the tree:
		while (q != root) {
			const bq = block[q];
			if (block[q] == undefined) throw new Error();
			i = i + 1;
			if (bq.first - q + bq.parity < 0) debugger;
			stack[i] = (bq.first - q + bq.parity) % 2;
			q = bq.parent - Math.trunc((bq.first - q + 1 - bq.parity) / 2);
		}
		// Output the bits
		for (let _ = i; _ >= 1; --_) {
			output += stack[_];
		}
	}

	function ReceiveAndDecode() {
		// TODO:
	}

	function InterchangeLeaves(e1, e2) {
		rep[alpha[e1]] = e2;
		rep[alpha[e2]] = e1;
		const temp = alpha[e1];
		alpha[e1] = alpha[e2];
		alpha[e2] = temp;
	}

	function Update(k) {
		let q, bq, oldParent, oldParity, b, nbq, slide, leafToIncrement;
		function FindNode() {
			q = rep[k];
			leafToIncrement = 0;
			if (q <= M) {
				InterchangeLeaves(q, M);
				if (R == 0) {
					R = M / 2;
					if (R > 0) E = E - 1;
				}
				M = M - 1;
				R = R - 1;
				q = M + 1;
				bq = block[q];
				if (M > 0) {
					// New 0-node is node M; old 0-node is node m+1;
					// new parent of nodes M and M + 1 is node M + n
					block[M] = bq;
					bq.last = M;
					oldParent = bq.parent;
					bq.parent = M + n;
					bq.parity = 1;
					// Create new internal block of zero weight for node M + n
					b = {
						weight: 0,
						parity: 0,
						parent: oldParent,
						rtChild: q,
						first: M + n,
						last: M + n,
						nextBlock: bq.nextBlock,
						prevBlock: bq,
					};
					block[M + n] = b;
					bq.nextBlock.prevBlock = b;
					bq.nextBlock = b;
					leafToIncrement = q; q = M + n;
				}
			} else {
				// Interchange q with it's block-leader.
				InterchangeLeaves(q, block[q].first);
				q = block[q].first;
				if (q == M + 1 && M > 0) {
					leafToIncrement = q; q = block[q].parent;
				}
			}
		}

		function SlideAndIncrement() {
			// q is currently the first node in its block (the block-leader)
			bq = block[q]; nbq = bq.nextBlock;
			let par = bq.parent; oldParent = par; oldParity = bq.parity;

			if ((q <= n && nbq.first > n && nbq.weight == bq.weight) || (q > n && nbq.first <= n && nbq.weight == bq.weight + 1)) {
				// Slide q over the next block
				slide = true;
				oldParent = nbq.parent; oldParity = nbq.parity;
				// adjust child pointers for next-neigher level in tree
				if (par > 0) {
					let bpar = block[par];
					if (bpar.rtChild == q) {
						bpar.rtChild = nbq.last;
					} else if (bpar.rtChild == nbq.first) {
						bpar.rtChild = q;
					} else {
						bpar.rtChild = bpar.rtChild + 1;
					}
					if (par != Z) {
						if (block[par + 1] != bpar) {
							if (block[par + 1].rtChild == nbq.first) {
								block[par + 1].rtChild = q;
							} else if (block[block[par + 1].rtChild] == nbq) {
								block[par + 1].rtChild = block[par + 1].rtChild + 1;
							}
						}
					}
				}
				// Adjust parent pointers for block nbq
				nbq.parent = nbq.parent -1 +nbq.parity; nbq.parity = 1 -nbq.parity;
				nbq = nbq.nextBlock;
			} else {
				slide = false;
			}

			if ((q <= n && nbq.first <= n) || (q > n && nbq.first > n) && nbq.weight == bq.weight + 1) {
				// Merge q into the block of weight one higher
				if (nbq == 1) debugger;
				block[q] = nbq; nbq.last = q;
				if (bq.last == q) {
					// q's old block disappears
					bq.prevBlock.nextBlock = bq.nextBlock;
					bq.nextBlock.prevBlock = bq.prevBlock;
				} else {
					if (q > n) {
						bq.rtChild = FindChild(q - 1, 1);
					}
					if (bq.parity == 0) {
						bq.parent = bq.parent - 1;
					}
					bq.parity = 1 - bq.parity; // Toggle the parity
					bq.first = q - 1;
				}
			} else if (bq.last == q) {
				if (slide) {
					// q's block slid forward in the block list
					bq.nextBlock.prevBlock = bq.prevBlock;
					bq.prevBlock.nextBlock = bq.nextBlock;
					bq.prevBlock = nbq.prevBlock;
					bq.nextBlock = nbq;
					nbq.prevBlock = bq;
					bq.prevBlock.nextBlock = bq;
					bq.parent = oldParent;
					bq.parity = oldParity;
				}
				bq.weight += 1;
			} else {
				// New block is created for q
				b = {
					weight: bq.weight + 1,
					parity: oldParity,
					parent: oldParent,
					rtChild: 0,
					first: q,
					last: q,
					nextBlock: nbq,
					prevBlock: nbq.prevBlock
				};
				block[q] = b;
				if (q > n) {
					b.rtChild = bq.rtChild;
					bq.rtChild = FindChild(q - 1, 1);
					if (b.rtChild == q - 1) {
						bq.parent = q;
					} else if (bq.parity == 0) {
						bq.parent = bq.parent - 1;
					}
				} else if (bq.parity == 0) {
					bq.parent = bq.parent - 1;
				}
				bq.first = q - 1; bq.parity = 1 - bq.parity;
				// Insert q's block in its proper place in the block list
				nbq.prevBlock = b; b.prevBlock.nextBlock = b;
			}
			// Move q one level higher in the tree
			if (q <= n) {
				q = oldParent;
			} else {
				q = par;
			}
		}

		// Set q to the node whose weight should increase
		FindNode();

		while (q > 0) {
			SlideAndIncrement();
		}
		// Finish up some special cases involving the 0-node
		if (leafToIncrement != 0) {
			q = leafToIncrement;
			SlideAndIncrement();
		}
	}

	// Encode the message:
	for (const b of message) {
		EncodeAndTransmit(b);
		Update(b);
	}

	return output;
}