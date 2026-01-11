
# GameWSServerShotResultMessage


## Properties

Name | Type
------------ | -------------
`row` | number
`col` | number
`hit` | boolean
`sunkLength` | [Ship](Ship.md)

## Example

```typescript
import type { GameWSServerShotResultMessage } from ''

// TODO: Update the object below with actual values
const example = {
  "row": null,
  "col": null,
  "hit": null,
  "sunkLength": null,
} satisfies GameWSServerShotResultMessage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GameWSServerShotResultMessage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


