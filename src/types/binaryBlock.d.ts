export interface BinaryBlock {
    indices: number[];
    aliceParity: number;
    bobParity: number;
    hasError: boolean;
    errorIndex?: number;
}
