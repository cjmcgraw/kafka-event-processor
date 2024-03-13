import _ from "lodash";
import {v4 as uuidv4} from 'uuid';


export const generateEvent = (anyFields={}) => ({
    model: uuidv4(),
    userId: _.random(1, 1_000_000_000),
    itemId: _.random(1, 1_000_000_000),
    price: _.random(1, 100_000),
    lowerBound: 1,
    upperBound: 100_000,
    ...anyFields,
});
        
  
