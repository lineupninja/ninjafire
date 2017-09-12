
import { Model } from '../../model';
import { Serializer } from '../../serializers/serializer';
import { BelongsToHandlerOptions } from '../belongs-to';
import { HasManyHandlerOptions } from '../has-many';
import { HandlerTypes, throwBadHandler } from '../types';

/**
 * Sets the inverse of a belongsTo or hasMany relationship
 * @param record The record being updated
 * @param attribute The attribute on the record being updated
 * @param handlingClass The class handling the record
 * @param options The options passed to the handler
 * @param link true to link the records, false to unlink them (Sets the relationship to null)
 */

export function setInverse<T extends Model | Serializer>(record: Model, attribute: string, handlingClass: { modelName?: string; new(): T; }, otherRecordId: string, options: BelongsToHandlerOptions | HasManyHandlerOptions, link: boolean): void {

    // Bail out if inverseOptions are not defined
    if (options.inverse === undefined) { return; }

    // Throw exception if the record is embedded and contains inverse relationships
    // This is not possible as the record on the other side of the inverse will not be able
    // to find the embedded record as the parent record is not known.

    if (record.embedded) {
        throw Error('Embedded records cannot contain relationships with inverses');
    }

    const otherAttribute = options.inverse;
    const otherRecord = record.store.peekRecord(handlingClass as { modelName?: string; new(): Model }, otherRecordId);

    if (otherRecord !== null) {

        if (otherRecord.schema[otherAttribute] === undefined) {
            throw Error(`inverse attribute ${otherAttribute} not found on record of type ${otherRecord.modelName} ${otherRecord.id}`);
        }

        const handlerType: HandlerTypes = otherRecord.schema[otherAttribute].handlerType;

        switch (handlerType) {
            case HandlerTypes.belongsTo:
                if (link) {
                    if (otherRecord[otherAttribute] !== null && otherRecord[otherAttribute].id !== record.id) {
                        // The other record is currently set to something other than the current record, set it to null to clear the relationship
                        otherRecord[otherAttribute] = null;
                    }
                    // Set the new inverse relationship directly on the localAttributes, this prevents a loop
                    otherRecord._localAttributes[otherAttribute] = record.id;

                } else {
                    otherRecord._localAttributes[otherAttribute] = null;
                }
                record._atomicallyLinked.push(otherRecord);
                otherRecord._atomicallyLinked.push(record);
                break;
            case HandlerTypes.hasMany:
                // Is hasMany relationship
                if (otherRecord._localAttributes[otherAttribute] === undefined) {
                    otherRecord._localAttributes[otherAttribute] = {};
                }
                if (link) {
                    otherRecord._localAttributes[otherAttribute][record.id] = true;
                } else {
                    otherRecord._localAttributes[otherAttribute][record.id] = null;
                }
                record._atomicallyLinked.push(otherRecord);
                otherRecord._atomicallyLinked.push(record);
                break;
            case HandlerTypes.attr:
                throw Error('Inverse relationship attribute is attr, should be belongsTo or hasMany');
            default:
                throwBadHandler(handlerType);
        }

    } else {
        throw Error(`The related record with id ${otherRecordId} is not in the store, this is not currently supported, perform a findRecord on it first`);
    }

}
