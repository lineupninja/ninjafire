
import { BooleanSerializer as _Boolean } from './boolean';
import { DateSerializer as _Date } from './date';
import { JSONSerializer as _JSON } from './json';
import { NumberSerializer as _Number } from './number';
import { StringSerializer as _String } from './string';

// tslint:disable:variable-name // Rule disabled as the exported names are namespaced under Serializers

export namespace Serializers {
    export const Boolean = _Boolean;
    export const Date = _Date;
    export const JSON = _JSON;
    export const Number = _Number;
    export const String = _String;
}
