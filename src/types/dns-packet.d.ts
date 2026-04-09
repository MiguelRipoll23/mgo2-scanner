declare module 'dns-packet' {
  export type RecordType =
    | 'A' | 'AAAA' | 'CAA' | 'CNAME' | 'DNSKEY' | 'DS' | 'HINFO'
    | 'MX' | 'NAPTR' | 'NS' | 'NSEC' | 'OPT' | 'PTR' | 'RP'
    | 'RRSIG' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'TLSA' | 'TXT'
    | 'ANY' | 'HTTPS' | 'SVCB';

  export type Class = 'IN' | 'CS' | 'CH' | 'HS' | 'ANY';

  export interface Question {
    type: RecordType;
    name: string;
    class?: Class;
  }

  export interface StringAnswer {
    type: 'A' | 'AAAA' | 'CNAME' | 'NS' | 'PTR' | 'SPF';
    name: string;
    class?: Class;
    ttl?: number;
    data: string;
  }

  export type Answer = StringAnswer | Record<string, unknown>;

  export interface Packet {
    type?: 'query' | 'response';
    id?: number;
    flags?: number;
    questions?: Question[];
    answers?: Answer[];
    additionals?: Answer[];
    authorities?: Answer[];
  }

  export const AUTHORITATIVE_ANSWER: number;
  export const TRUNCATED_RESPONSE: number;
  export const RECURSION_DESIRED: number;
  export const RECURSION_AVAILABLE: number;
  export const AUTHENTIC_DATA: number;
  export const CHECKING_DISABLED: number;

  export function encode(packet: Packet, buf?: Buffer, offset?: number): Buffer;
  export function decode(buf: Buffer, offset?: number): Packet;
  export function encodingLength(packet: Packet): number;
}
