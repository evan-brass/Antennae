// A transcoding of Vitter's Algorithm 673 which was written in Pascal

export function encode_vitter(message) {
	let output = "";

	const parent = [], rtChild = [], parity = [], block = [], prevBlock = [], nextBlock = [], first = [], last = [];
	const weight = [];

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
	// Create a single block for the 0-node which starts as node[n]
	block[n] = 1; prevBlock[1] = 1; nextBlock[1] = 1; weight[1] = 0;
	first[1] = n; last[1] = n; parity[1] = 0; parent[1] = 0;
	let availBlock = 2;
	for (let i = availBlock; i <= Z - 1; ++i) {
		nextBlock[i] = i + 1;
	}
	nextBlock[Z] = 0;
	let root; // Root is set in EncodeAndTransmit

	function FindChild(j, parity) {
		let delta = 2 * (first[block[j]] - j) + 1 - parity;
		let right = rtChild[block[j]], gap = right - last[block[right]];
		if (delta <= gap) return right - delta;
		else {
			delta = delta - gap - 1;
			right = first[prevBlock[block[right]]]; gap = right-last[block[right]];
			if (delta <= gap) return right - delta;
			else return first[prevBlock[block[right]]] - delta + gap + 1;
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
			if (block[q] == undefined) throw new Error();
			i = i + 1;
			if (first[block[q]] - q + parity[block[q]] < 0) debugger;
			stack[i] = (first[block[q]] - q + parity[block[q]]) % 2;
			q = parent[block[q]] - Math.trunc((first[block[q]] - q + 1 - parity[block[q]]) / 2);
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
					last[bq] = M;
					oldParent = parent[bq];
					parent[bq] = M + n;
					parity[bq] = 1;
					// Create new internal block of zero weight for node M + n
					b = availBlock; availBlock = nextBlock[availBlock];
					prevBlock[b] = bq; nextBlock[b] = nextBlock[bq];
					prevBlock[nextBlock[bq]] = b; nextBlock[bq] = b;
					parent[b] = oldParent; parity[b] = 0; rtChild[b] = q;
					block[M + n] = b; weight[b] = 0;
					first[b] = M + n; last[b] = M + n;
					leafToIncrement = q; q = M + n;
				}
			} else {
				// Interchange q with it's block-leader.
				InterchangeLeaves(q, first[block[q]]);
				q = first[block[q]];
				if (q == M + 1 && M > 0) {
					leafToIncrement = q; q = parent[block[q]];
				}
			}
		}

		function SlideAndIncrement() {
			// q is currently the first node in its block (the block-leader)
			bq = block[q]; nbq = nextBlock[bq];
			let par = parent[bq]; oldParent = par; oldParity = parity[bq];

			if ((q <= n && first[nbq] > n && weight[nbq] == weight[bq]) || (q > n && first[nbq] <= n && weight[nbq] == weight[bq] + 1)) {
				// Slide q over the next block
				slide = true;
				oldParent = parent[nbq]; oldParity = parity[nbq];
				// adjust child pointers for next-neigher level in tree
				if (par > 0) {
					let bpar = block[par];
					if (rtChild[bpar] == q) {
						rtChild[bpar] = last[nbq];
					} else if (rtChild[bpar] == first[nbq]) {
						rtChild[bpar] = q;
					} else {
						rtChild[bpar] = rtChild[bpar] + 1;
					}
					if (par != Z) {
						if (block[par + 1] != bpar) {
							if (rtChild[block[par + 1]] == first[nbq]) {
								rtChild[block[par + 1]] = q;
							} else if (block[rtChild[block[par + 1]]] == nbq) {
								rtChild[block[par + 1]] = rtChild[block[par + 1]] + 1;
							}
						}
					}
				}
				// Adjust parent pointers for block nbq
				parent[nbq] = parent[nbq] -1 +parity[nbq]; parity[nbq] = 1 -parity[nbq];
				nbq = nextBlock[nbq];
			} else {
				slide = false;
			}

			if ((q <= n && first[nbq] <= n) || (q > n && first[nbq] > n) && weight[nbq] == weight[bq] + 1) {
				// Merge q into the block of weight one higher
				if (nbq == 1) debugger;
				block[q] = nbq; last[nbq] = q;
				if (last[bq] = q) {
					// q's old block disappears
					nextBlock[prevBlock[bq]] = nextBlock[bq];
					prevBlock[nextBlock[bq]] = prevBlock[bq];
					nextBlock[bq] = availBlock; availBlock = bq;
				} else {
					if (q > n) {
						rtChild[bq] = FindChild(q - 1, 1);
					}
					if (parity[bq] == 0) {
						parent[bq] = parent[bq] - 1;
					}
					parity[bq] = 1 - parity[bq]; // Toggle the parity
					first[bq] = q - 1;
				}
			} else if (last[bq] == q) {
				if (slide) {
					// q's block slid forward in the block list
					prevBlock[nextBlock[bq]] = prevBlock[bq];
					nextBlock[prevBlock[bq]] = nextBlock[bq];
					prevBlock[bq] = prevBlock[nbq]; nextBlock[bq] = nbq;
					prevBlock[nbq] = bq; nextBlock[prevBlock[bq]] = bq;
					parent[bq] = oldParent; parity[bq] = oldParity;
				}
				weight[bq] = weight[bq] + 1;
			} else {
				// New block is created for q
				b = availBlock; availBlock = nextBlock[availBlock];
				if (b == 1) debugger;
				block[q] = b; first[b] = q; last[b] = q;
				if (q > n) {
					rtChild[b] = rtChild[bq];
					rtChild[bq] = FindChild(q - 1, 1);
					if (rtChild[b] == q - 1) {
						parent[bq] = q;
					} else if (parity[bq] = 0) {
						parent[bq] = parent[bq] - 1;
					}
				} else if (parity[bq] == 0) {
					parent[bq] = parent[bq] - 1;
				}
				first[bq] = q - 1; parity[bq] = 1 - parity[bq];
				// Insert q's block in its proper place in the block list
				prevBlock[b] = prevBlock[nbq]; nextBlock[b] = nbq;
				prevBlock[nbq] = b; nextBlock[prevBlock[b]] = b;
				weight[b] = weight[bq] + 1;
				parent[b] = oldParent; parity[b] = oldParity;
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