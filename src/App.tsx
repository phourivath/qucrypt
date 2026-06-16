import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BasisSelector } from './components/basis-selector';
import { BinaryDisplay } from './components/binary-display';
import { ModeToggle } from './components/mode-toggle';
import { ThemeProvider } from './components/theme-provider';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Checkbox } from './components/ui/checkbox';
import { Label } from './components/ui/label';
import type { BinaryBlock } from './types/binaryBlock';

export default function BB84Simulator() {
  const [inputText, setInputText] = useState('');
  const [bases, setBases] = useState<string[]>([]);
  const [transmitted, setTransmitted] = useState(false);
  const [eveEnabled, setEveEnabled] = useState(false);
  const [noiseEnabled, setNoiseEnabled] = useState(false);
  const [eveSentQubits, setEveSentQubits] = useState(false);
  const [eveIntercepted, setEveIntercepted] = useState(false);
  const [eveBases, setEveBases] = useState<string[]>([]);
  const [eveMeasurements, setEveMeasurements] = useState<string[]>([]);
  const [aliceBasisVisible, setAliceBasisVisible] = useState(true);
  const [bobBases, setBobBases] = useState<string[]>([]);
  const [measured, setMeasured] = useState(false);
  const [bobMeasurements, setBobMeasurements] = useState<string[]>([]);
  const [compared, setCompared] = useState(false);
  const [results, setResults] = useState(false);
  const [errorEstimation, setErrorEstimation] = useState(false);
  const [errorCorrection, setErrorCorrection] = useState(false);
  const [cascadeRounds, setCascadeRounds] = useState<
    Array<{
      round: number;
      blockSize: number;
      blocksChecked: number;
      errorsFound: number;
      correctedKey: string[];
      blocks: Array<BinaryBlock>;
    }>
  >([]);

  // Convert text to binary
  const textToBinary = (text: string) => {
    return text
      .split('')
      .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join('');
  };

  const binaryString = inputText ? textToBinary(inputText) : '';

  // Initialize bases array when binary string changes
  useEffect(() => {
    if (binaryString) {
      setBases(new Array(binaryString.length).fill('+'));
      setBobBases(new Array(binaryString.length).fill('+'));
      if (eveEnabled) {
        setEveBases(new Array(binaryString.length).fill('+'));
      }
    } else {
      setBases([]);
      setEveBases([]);
      setBobBases([]);
    }
    // Realistic (noise) mode requires at least 256 bits. If the secret is
    // shortened below that, untick it so it can't stay enabled.
    if (binaryString.length < 256) {
      setNoiseEnabled(false);
    }
    setTransmitted(false);
    setAliceBasisVisible(true);
    setEveIntercepted(false);
    setEveSentQubits(false);
    setMeasured(false);
    setCompared(false);
    setResults(false);
    setErrorEstimation(false);
    setErrorCorrection(false);
  }, [binaryString]);

  // Auto-scroll to bottom when new cards appear
  useEffect(() => {
    if (
      transmitted ||
      eveIntercepted ||
      eveSentQubits ||
      measured ||
      compared ||
      results ||
      errorEstimation ||
      errorCorrection
    ) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [
    transmitted,
    eveIntercepted,
    eveSentQubits,
    measured,
    compared,
    results,
    errorEstimation,
    errorCorrection
  ]);

  // Toggle basis for a specific bit
  const toggleBasis = (index: number) => {
    setBases((prev) => {
      const newBases = [...prev];
      newBases[index] = newBases[index] === '+' ? 'x' : '+';
      return newBases;
    });
  };

  // Toggle Eve's basis
  const toggleEveBasis = (index: number) => {
    setEveBases((prev) => {
      const newBases = [...prev];
      newBases[index] = newBases[index] === '+' ? 'x' : '+';
      return newBases;
    });
  };

  // Toggle Bob's basis
  const toggleBobBasis = (index: number) => {
    setBobBases((prev) => {
      const newBases = [...prev];
      newBases[index] = newBases[index] === '+' ? 'x' : '+';
      return newBases;
    });
  };

  const matchingIndices = bases
    .map((basis, index) => (basis === bobBases[index] ? index : null))
    .filter((i): i is number => i !== null);

  const usableKey = bobMeasurements.filter(
    (_, index) => bases[index] === bobBases[index]
  );

  const aliceUsableKey = binaryString
    .split('')
    .filter((_, index) => bases[index] === bobBases[index]);

  // Select random subset for error checking (50% of the usable key)
  const sampleSize = Math.max(1, Math.ceil(usableKey.length * 0.5));

  const usableKeyIndices = Array.from(
    { length: usableKey.length },
    (_, i) => i
  );

  const sampledUsableIndices = usableKeyIndices
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);

  const errors = sampledUsableIndices.filter(
    (i) => aliceUsableKey[i] !== usableKey[i]
  ).length;

  const errorRate = sampleSize > 0 ? (errors / sampleSize) * 100 : 0;

  const hasEavesdropping = errorRate > 11;

  // The simulation can end on three different routes:
  //  - basic run with no noise/Eve finishes at the Result card
  //  - error estimation aborts because eavesdropping was detected
  //  - the Cascade error correction completes
  const simulationFinished =
    (results && !noiseEnabled && !eveEnabled) ||
    (errorEstimation && hasEavesdropping) ||
    errorCorrection;

  const runCascadeProtocol = () => {
    const rounds: Array<{
      round: number;
      blockSize: number;
      blocksChecked: number;
      errorsFound: number;
      correctedKey: string[];
      blocks: Array<BinaryBlock>;
    }> = [];

    const currentBobKey = [...usableKey];
    const aliceKey = [...aliceUsableKey];
    const keyLength = currentBobKey.length;

    // 4 rounds with increasing block sizes
    const blockSizes = [
      Math.ceil((0.73 / (errorRate || 1)) * 100), // adaptive to error rate
      Math.ceil(keyLength / 8),
      Math.ceil(keyLength / 4),
      Math.ceil(keyLength / 2)
    ];

    for (let round = 0; round < 4; round++) {
      const blockSize = Math.max(4, Math.min(blockSizes[round], keyLength));
      let errorsFound = 0;
      let blocksChecked = 0;
      const blockInfo: Array<BinaryBlock> = [];

      // Shuffle indices for rounds after the first
      let indices = Array.from({ length: keyLength }, (_, i) => i);
      if (round > 0) {
        indices = indices.sort(() => Math.random() - 0.5);
      }

      // Process blocks
      for (let start = 0; start < keyLength; start += blockSize) {
        const end = Math.min(start + blockSize, keyLength);
        const blockIndices = indices.slice(start, end);

        // Calculate parities
        const aliceParity =
          blockIndices.reduce(
            (sum, idx) => sum + parseInt(aliceKey[idx], 10),
            0
          ) % 2;
        const bobParity =
          blockIndices.reduce(
            (sum, idx) => sum + parseInt(currentBobKey[idx], 10),
            0
          ) % 2;

        blocksChecked++;
        let errorIndex: number | undefined;

        // If parity mismatch, use binary search to find error
        if (aliceParity !== bobParity) {
          let left = 0;
          let right = blockIndices.length - 1;

          while (left < right) {
            const mid = Math.floor((left + right) / 2);
            const leftIndices = blockIndices.slice(left, mid + 1);

            const aliceLeftParity =
              leftIndices.reduce(
                (sum, idx) => sum + parseInt(aliceKey[idx], 10),
                0
              ) % 2;
            const bobLeftParity =
              leftIndices.reduce(
                (sum, idx) => sum + parseInt(currentBobKey[idx], 10),
                0
              ) % 2;

            if (aliceLeftParity !== bobLeftParity) {
              right = mid;
            } else {
              left = mid + 1;
            }
          }

          // Flip the bit at the error position
          errorIndex = blockIndices[left];
          currentBobKey[errorIndex] =
            currentBobKey[errorIndex] === '1' ? '0' : '1';
          errorsFound++;
        }

        blockInfo.push({
          indices: blockIndices,
          aliceParity,
          bobParity,
          hasError: aliceParity !== bobParity,
          errorIndex
        });
      }

      rounds.push({
        round: round + 1,
        blockSize,
        blocksChecked,
        errorsFound,
        correctedKey: [...currentBobKey],
        blocks: blockInfo
      });
    }

    setCascadeRounds(rounds);
  };

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div className="min-h-screen w-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Title */}
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">
                  BB84 Quantum Key Distribution Simulator
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Watch Alice and Bob build a shared secret key out of single
                  particles of light - and see how any eavesdropper, Eve, gives
                  herself away.
                </p>
              </div>
              <ModeToggle />
            </div>
          </div>

          {/* Alice's Key Card */}
          <Card className="shadow-none mb-8">
            <CardContent className="flex flex-col gap-5">
              <CardTitle className="text-xl">Alice's Secret Key</CardTitle>
              <CardDescription>
                Alice wants to send Bob a secret key. She first writes it out
                (Please write any random text in her place). The simulator will
                convert the text to bits - plain 0s and 1s
              </CardDescription>

              <Input
                id="text-input"
                type="text"
                placeholder="Type your key here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />

              {/* Binary Display */}
              {inputText && (
                <>
                  <BinaryDisplay bits={binaryString.split('')} />
                  <div className="text-sm">
                    <span className="font-semibold">Total bits:</span>{' '}
                    {binaryString.length}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Alice's Basis Card */}
          {inputText && (
            <Card className="shadow-none">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl">
                  Alice's Transmission Bases
                </CardTitle>
                <CardDescription>
                  Normally this would be sent over the internet as ordinary bits
                  - but not here. We use qubits: single particles of light
                  (photons). It will also be sent over a different channel
                  called the{' '}
                  <span className="text-foreground font-medium">
                    "quantum channel"
                  </span>
                  .
                  <br />
                  <br />
                  To encode each bit as a qubit, we first pick a random basis, +
                  or x. Right now only Alice knows which basis she chose. Click
                  Transmit to send the qubits to Bob.
                </CardDescription>
                {aliceBasisVisible ? (
                  <BasisSelector bases={bases} onToggle={toggleBasis} />
                ) : (
                  <div className="flex items-center justify-center py-2 text-muted-foreground">
                    <p>Alice's bases are hidden</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  {transmitted && (
                    <Button
                      variant="outline"
                      onClick={() => setAliceBasisVisible(!aliceBasisVisible)}
                    >
                      {aliceBasisVisible ? 'Hide Bases' : 'Show Bases'}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setBases(
                        new Array(binaryString.length)
                          .fill(null)
                          .map(() => (Math.random() > 0.5 ? '+' : 'x'))
                      );
                    }}
                    disabled={transmitted}
                  >
                    Randomize for me!!!
                  </Button>
                  <Button
                    onClick={() => {
                      setTransmitted(true);
                      setAliceBasisVisible(false);
                    }}
                    disabled={transmitted}
                  >
                    Transmit
                  </Button>
                </div>

                <CardTitle className="text-xl">Advanced Simulation</CardTitle>
                <CardDescription className="text-white">
                  Don't be intimidated! You may skip these options on your first
                  run.
                </CardDescription>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="noise-toggle"
                    checked={noiseEnabled}
                    onCheckedChange={(checked) => {
                      setNoiseEnabled(checked as boolean);

                      // Reset Eve's state
                      setEveIntercepted(false);
                      setEveSentQubits(false);
                      setEveMeasurements([]);

                      // Reset Bob's state when toggling noise
                      setMeasured(false);
                      setCompared(false);
                      setResults(false);
                      setBobMeasurements([]);
                      setErrorEstimation(false);
                      setErrorCorrection(false);
                    }}
                    disabled={binaryString.length < 256}
                  />
                  <Label
                    htmlFor="noise-toggle"
                    className={`text-sm cursor-pointer ${binaryString.length < 256 ? 'opacity-50' : ''}`}
                  >
                    Give me realistic version
                  </Label>
                </div>
                <CardDescription>
                  Real quantum channels aren't perfect. Lost photons (light),
                  imperfect detectors, and other interferences, making the bits
                  flips on their own, adding a small error rate (~5%) even when
                  no one is eavesdropping. This is called{' '}
                  <span className="text-foreground font-medium">"Noise"</span>.
                </CardDescription>
                {binaryString.length < 256 && (
                  <CardDescription className="text-amber-600 dark:text-amber-400">
                    Note: To enable this mode, please write your secret text a
                    bit longer. Short keys leave too few bits to tell real noise
                    apart from eavesdropping.
                  </CardDescription>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="eve-toggle"
                    checked={eveEnabled}
                    onCheckedChange={(checked) => {
                      setEveEnabled(checked as boolean);

                      // Reset Eve's state
                      setEveBases(
                        checked ? new Array(binaryString.length).fill('+') : []
                      );

                      // Reset Eve's state
                      setEveIntercepted(false);
                      setEveSentQubits(false);
                      setEveMeasurements([]);

                      // Reset Bob's state when toggling Eve
                      setBobBases(new Array(binaryString.length).fill('+'));
                      setMeasured(false);
                      setCompared(false);
                      setResults(false);
                      setBobMeasurements([]);
                      setErrorEstimation(false);
                      setErrorCorrection(false);
                    }}
                  />
                  <Label
                    htmlFor="eve-toggle"
                    className="text-sm cursor-pointer"
                  >
                    Introduce eavesdropper (Eve)
                  </Label>
                </div>
                <CardDescription>
                  Eve is the eavesdropper. She secretly taps the channel and
                  tries to read each qubit as it travels from Alice to Bob,
                  hoping to steal the key unnoticed.
                </CardDescription>
              </CardContent>
            </Card>
          )}

          {/* Eve's Interception Card */}
          {transmitted && eveEnabled && (
            <Card className="shadow-none mt-8 border-red-200 dark:border-red-900">
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl text-red-600 dark:text-red-400">
                    Eve's Interception
                  </CardTitle>
                </div>
                <CardDescription>
                  Eve catches the qubits before Bob does. But to read a qubit
                  she must measure it. Remeber the{' '}
                  <span className="text-foreground font-medium">"bases"</span>{' '}
                  we picked to encode the information?, yeah she need those
                  exact thing to measure these qubit.
                  <br />
                  <br />
                  To bad for her, becuase she never knows Alice's chosen bases.
                  So she have to guess (don't be cheating and went up and look
                  xD)
                </CardDescription>

                <p className="text-sm font-medium">Eve's Measurement Bases:</p>
                <BasisSelector bases={eveBases} onToggle={toggleEveBasis} />

                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEveBases(
                        new Array(binaryString.length)
                          .fill(null)
                          .map(() => (Math.random() > 0.5 ? '+' : 'x'))
                      );
                    }}
                  >
                    Randomize for me again
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      // Eve measures the qubits
                      const measurements = binaryString
                        .split('')
                        .map((bit, index) => {
                          if (bases[index] === eveBases[index]) {
                            // Eve's basis matches Alice's - correct measurement
                            return bit;
                          } else {
                            // Eve's basis doesn't match - random result
                            return Math.random() > 0.5 ? '1' : '0';
                          }
                        });
                      setEveMeasurements(measurements);
                      setEveIntercepted(true);
                    }}
                  >
                    Intercept & Measure
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Eve's Measurement Results Card */}
          {eveIntercepted && (
            <Card className="shadow-none mt-8 border-red-200 dark:border-red-900">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl text-red-600 dark:text-red-400">
                  Eve's Measurement Results
                </CardTitle>
                <CardDescription>
                  Here's the catch: when Eve's guessed basis matches Alice's,
                  she reads the bit correctly. When it doesn't, measuring
                  disturbs the qubit and she gets a random result, either 1 or
                  0.
                </CardDescription>
                <CardDescription>
                  After measuring, Eve must fake new qubits to Bob (otherwise
                  Bob would notice nothing arrived). This introduces errors that
                  will reveal her presence.
                </CardDescription>

                <div className="flex flex-wrap gap-1">
                  <BinaryDisplay bits={eveMeasurements} />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="destructive"
                    onClick={() => setEveSentQubits(true)}
                  >
                    Send New Qubits to Bob
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bob's Basis Card */}
          {transmitted && (!eveEnabled || eveSentQubits) && (
            <Card className="shadow-none mt-8">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl">
                  Bob's Measurement Bases
                </CardTitle>
                <CardDescription>
                  Bob receives the qubits but doesn't know Alice's bases as
                  well. For each one he picks his own basis at random. When it
                  matches Alice's, he reads the bit correctly; when it doesn't,
                  measuring scrambles it into a random result.
                </CardDescription>
                {eveIntercepted && (
                  <CardDescription className="text-red-600 dark:text-red-400">
                    Warning: these qubits passed through Eve. Bob is measuring
                    the replacements she sent, not Alice's originals — so Eve's
                    guessing errors are already baked into what Bob receives.
                  </CardDescription>
                )}
                <CardDescription>
                  In a real run Bob is a separate person. Here there's no one
                  else, so play Bob yourself: measure the qubits without peeking
                  at the bases you just chose. Click Measure when ready.
                </CardDescription>
                <BasisSelector bases={bobBases} onToggle={toggleBobBasis} />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setBobBases(
                        new Array(binaryString.length)
                          .fill(null)
                          .map(() => (Math.random() > 0.5 ? '+' : 'x'))
                      );
                    }}
                  >
                    Randomize again...
                  </Button>
                  <Button
                    onClick={() => {
                      const measurements = binaryString
                        .split('')
                        .map((bit, index) => {
                          // if Eve intercepted, Bob measures Eve's qubits
                          const sourceData = eveIntercepted
                            ? eveMeasurements[index]
                            : bit;
                          const sourceBasis = eveIntercepted
                            ? eveBases[index]
                            : bases[index];

                          let measuredBit: string;
                          if (sourceBasis === bobBases[index]) {
                            measuredBit = sourceData;
                          } else {
                            measuredBit = Math.random() > 0.5 ? '1' : '0';
                          }

                          // Apply channel noise (~5% error rate)
                          if (noiseEnabled && Math.random() < 0.05) {
                            measuredBit = measuredBit === '1' ? '0' : '1';
                          }

                          return measuredBit;
                        });
                      setBobMeasurements(measurements);
                      setMeasured(true);
                    }}
                  >
                    Measure
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bob's Measurement Results Card */}
          {measured && (
            <Card className="shadow-none mt-8">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl">
                  Bob's Measurement Results
                </CardTitle>
                <CardDescription>
                  Bob has now measured every qubit. Some results match Alice's
                  original bits and some don't, depending on whether his basis
                  happened to match hers for that qubit.
                </CardDescription>
                <div className="flex flex-wrap gap-1">
                  <BinaryDisplay bits={bobMeasurements} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="default" onClick={() => setCompared(true)}>
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bases Comparison Card */}
          {compared && (
            <Card className="shadow-none mt-8">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl">Bases Comparison</CardTitle>
                <CardDescription>
                  So how do they find the bits they can trust? Bob publicly
                  announces only which basis he used for each qubit, and Alice
                  replies which positions match the basis she used.
                </CardDescription>
                <CardDescription>
                  The key points here are:
                  <p> - Bob reveals only his bases, never the measured bits</p>
                  <p>
                    {' '}
                    - He can announce them over an ordinary (classical) channel
                  </p>
                </CardDescription>
                <div className="space-y-4">
                  {/* Bob's Bases */}
                  <p className="text-sm font-medium mb-2">Bob's Bases:</p>
                  <BasisSelector bases={bobBases} onToggle={() => {}} />

                  <p className="text-sm font-medium mb-2">
                    Alice says the correct bases are index:{' '}
                  </p>

                  <p className="text-sm">
                    {matchingIndices.length > 0
                      ? matchingIndices.join(', ')
                      : 'None'}
                  </p>

                  {/* Match indicator */}
                  <p className="text-sm">
                    <span className="font-semibold">Matching bases:</span>{' '}
                    {
                      bases.filter((basis, index) => basis === bobBases[index])
                        .length
                    }{' '}
                    out of {bases.length}
                  </p>

                  <div className="flex gap-2 justify-end">
                    <Button variant="default" onClick={() => setResults(true)}>
                      Continue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result Card */}
          {results && (
            <Card className="shadow-none mt-8">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl">Result</CardTitle>
                <CardDescription>
                  Wherever their bases matched, Alice and Bob hold the same bit.
                  They throw away every position where the bases differed and
                  keep the rest as the shared secret key. This is called{' '}
                  <span className="text-primary">Basis Sifting</span>.
                </CardDescription>
                <CardDescription>
                  Why discard them? When the bases differ, the qubit was
                  measured the wrong way, so the bit is random to either 1 or 0
                  as mentioned before there's no way to know if it's right.
                  Useless bits, so they go.
                </CardDescription>
                <div className="space-y-4">
                  {/* Bob's Correct Bases */}
                  <p className="text-sm font-medium mb-2">
                    Bob's Correct Bases:
                  </p>
                  <BasisSelector
                    bases={bobBases}
                    onToggle={() => {}}
                    opacity={(index) => bases[index] === bobBases[index]}
                  />

                  {/* Bob's Measurement */}
                  <p className="text-sm font-medium mb-2">Bob's Measurement:</p>
                  <BinaryDisplay
                    bits={bobMeasurements}
                    opacity={(index) => bases[index] === bobBases[index]}
                  />

                  {/* Usable Key */}
                  <p className="text-sm font-medium mb-2">Usable Key:</p>
                  <BinaryDisplay
                    bits={bobMeasurements.filter(
                      (_, index) => bases[index] === bobBases[index]
                    )}
                  />

                  {(noiseEnabled || eveEnabled) && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="default"
                        onClick={() => setErrorEstimation(true)}
                      >
                        Continue
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Estimation Card */}
          {errorEstimation && (
            <Card className="shadow-none mt-8">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl">Error Estimation</CardTitle>
                <CardDescription>
                  Before trusting the key, Alice and Bob check whether anyone
                  listened in. They publicly compare a small random sample of
                  their kept bits and count how often the two disagree.
                </CardDescription>
                <CardDescription>
                  An eavesdropper's wrong guesses leave errors behind. If more
                  than 11% of the sampled bits disagree, someone was likely
                  listening - real systems abort and restart. Below that, they
                  move on to fix the few remaining errors.
                </CardDescription>

                <div className="border-t space-y-2 pt-4">
                  <p className="text-sm font-medium">
                    Sample size: {sampleSize} bits out of {usableKey.length}{' '}
                    usable key bits (
                    {usableKey.length > 0
                      ? ((sampleSize / usableKey.length) * 100).toFixed(1)
                      : 0}
                    %)
                  </p>

                  <p className="text-sm font-medium">Alice's Usable Key:</p>
                  <BinaryDisplay
                    bits={aliceUsableKey}
                    opacity={(index) => sampledUsableIndices.includes(index)}
                  />

                  <p className="text-sm font-medium">Bob's Usable Key:</p>
                  <BinaryDisplay
                    bits={usableKey}
                    opacity={(index) => sampledUsableIndices.includes(index)}
                  />

                  {hasEavesdropping ? (
                    <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg mt-4">
                      <p className="text-sm text-red-800 dark:text-red-200 font-semibold">
                        Eavesdropping Detected!
                      </p>
                      <div className="pt-4">
                        <p className="text-sm">Errors detected: {errors}</p>
                        <p className="text-sm">
                          Error rate:{' '}
                          <span
                            className={
                              hasEavesdropping
                                ? 'text-red-600 dark:text-red-400 font-bold'
                                : 'text-green-600 dark:text-green-400 font-bold'
                            }
                          >
                            {errorRate.toFixed(2)}%
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg mt-4">
                        <p className="text-sm text-green-800 dark:text-green-200 font-semibold">
                          Channel Secure
                        </p>
                        <div className="pt-4">
                          <p className="text-sm">Errors detected: {errors}</p>
                          <p className="text-sm">
                            Error rate:{' '}
                            <span
                              className={
                                hasEavesdropping
                                  ? 'text-red-600 dark:text-red-400 font-bold'
                                  : 'text-green-600 dark:text-green-400 font-bold'
                              }
                            >
                              {errorRate.toFixed(2)}%
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <Button
                          variant="default"
                          onClick={() => {
                            setErrorCorrection(true);
                            runCascadeProtocol();
                          }}
                        >
                          Continue to Error Correction
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Correction Card */}
          {errorCorrection && (
            <Card className="shadow-none mt-8">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl">
                  Error Correction - Cascade Protocol
                </CardTitle>
                <CardDescription>
                  The Cascade protocol fixes the remaining errors. It splits the
                  key into blocks and checks each block's parity - whether it
                  holds an even or odd number of 1s. A mismatch reveals an
                  error, which it pins down over several shuffled rounds.
                </CardDescription>

                <div className="space-y-6">
                  {cascadeRounds.map((round, roundIndex) => (
                    <div
                      key={`${roundIndex}-${round}`}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <p className="font-semibold">Round {round.round}</p>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <p>
                          <span>Blocks:</span> {round.blocksChecked}
                        </p>
                        <p>
                          <span>Block size:</span> {round.blockSize} bits
                        </p>
                        <p>
                          <span>Errors found:</span> {round.errorsFound}
                        </p>
                      </div>

                      <div className="space-y-3 mt-4">
                        {round.blocks.map((block, blockIndex) => {
                          const bobKey =
                            roundIndex === 0
                              ? usableKey
                              : cascadeRounds[roundIndex - 1].correctedKey;
                          const blockBits = block.indices.map(
                            (idx) => bobKey[idx]
                          );
                          const aliceBlockBits = block.indices.map(
                            (idx) => aliceUsableKey[idx]
                          );

                          return (
                            <div
                              key={`${blockIndex}-${block}`}
                              className="p-3 rounded-md border bg-muted/30"
                            >
                              <p className="text-sm font-semibold mb-3">
                                Block {blockIndex + 1}
                              </p>

                              <div className="grid grid-cols-2 gap-6">
                                {/* Alice's side */}
                                <div>
                                  <p className="text-xs mb-2">
                                    Alice parity: {block.aliceParity}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {aliceBlockBits.map((bit, index) => (
                                      <Badge
                                        key={`${index}-${bit}`}
                                        variant="outline"
                                        className="w-10 h-10 flex text-lg rounded-md"
                                      >
                                        {bit}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                {/* Bob's side */}
                                <div>
                                  <p className="text-xs mb-2">
                                    Bob parity: {block.bobParity}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {blockBits.map((bit, index) => (
                                      <Badge
                                        key={`${index}-${bit}`}
                                        variant="outline"
                                        className={`w-10 h-10 flex text-lg rounded-md ${
                                          block.errorIndex ===
                                          block.indices[index]
                                            ? 'bg-primary text-primary-foreground font-bold border-primary'
                                            : ''
                                        }`}
                                      >
                                        {bit}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {block.hasError &&
                                block.errorIndex !== undefined && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Error corrected at position{' '}
                                    {block.errorIndex}
                                  </p>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="space-y-3 mt-6">
                    <p className="text-sm font-medium">Final Result:</p>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Alice's Key:
                      </p>
                      <BinaryDisplay bits={aliceUsableKey} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Bob's Corrected Key:
                      </p>
                      <BinaryDisplay
                        bits={
                          cascadeRounds[cascadeRounds.length - 1].correctedKey
                        }
                      />
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-muted/50">
                    <p className="text-sm font-semibold">
                      Error Correction Complete
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Done. After {cascadeRounds.length} rounds of Cascade,
                      Alice and Bob hold an identical secret key — known only to
                      them and ready to encrypt real messages.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Q&A Card */}
          {simulationFinished && (
            <Card className="shadow-none mt-8">
              <CardContent className="flex flex-col gap-5">
                <CardTitle className="text-xl">
                  Wait, I have questions...
                </CardTitle>
                <CardDescription>
                  You made it to the end. A few things probably feel odd right
                  now, so let's clear them up.
                </CardDescription>

                <div className="space-y-1">
                  <p className="text-sm text-foreground font-medium">
                    So... where's my secret text? This final key looks like
                    gibberish.
                  </p>
                  <CardDescription>
                    It's supposed to look like gibberish. BB84 never sends your
                    message - it builds a shared{' '}
                    <span className="text-foreground font-medium">
                      random key
                    </span>
                    . The text you typed was only a source of random bits, and
                    its meaning is thrown away on purpose. So yes, this is for{' '}
                    <span className="text-foreground font-medium">
                      secrecy only
                    </span>
                    : anything you wrote with meaning is gone. Alice and Bob
                    later use this key to encrypt a real message (for example
                    with a one-time pad).
                  </CardDescription>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-foreground font-medium">
                    Why is the final key so much shorter than what I typed?
                  </p>
                  <CardDescription>
                    About half the bits are dropped during{' '}
                    <span className="text-foreground font-medium">
                      basis sifting
                    </span>{' '}
                    (where Alice's and Bob's bases didn't match), and a random
                    sample is spent during error estimation. Losing more than
                    half of your bits is completely normal.
                  </CardDescription>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-foreground font-medium">
                    Why can't Eve just copy each qubit and measure it later?
                  </p>
                  <CardDescription>
                    Because of the{' '}
                    <span className="text-foreground font-medium">
                      no-cloning theorem
                    </span>
                    : an unknown quantum state cannot be copied. Eve has to
                    measure as the qubit flies past, and measuring in the wrong
                    basis disturbs it - which is exactly what gives her away.
                  </CardDescription>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-foreground font-medium">
                    If they can talk on the classical channel, why not just send
                    the key there?
                  </p>
                  <CardDescription>
                    The{' '}
                    <span className="text-foreground font-medium">
                      classical channel
                    </span>{' '}
                    is public - anyone, including Eve, can listen. So Alice and
                    Bob only exchange bases and parities there, never the key
                    bits themselves. The secrecy comes from the quantum channel,
                    where any eavesdropping leaves detectable traces.
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}
