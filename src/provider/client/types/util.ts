export type PossibleArray<T> = T | T[];

export type Opaque<K, T> = T & { __TYPE__: K };

export type ISODateString = Opaque<'Date', string>;
