import React from 'react'
import { MetaNode } from '@/spec/metanode'
import { RegulatoryElementTerm } from '@/components/core/term'
import { GeneSet, RegulatoryElementSet, VariantSet } from '@/components/core/set'
import { z } from 'zod'
import { linkeddatahub_icon, datafile_icon } from '@/icons'
import { Table, Cell, Column} from '@/app/components/Table'
import { downloadBlob } from '@/utils/download'
import { myRegElemInfo_query, getRegElemPositionData, RegulatoryElementInfoC, RE_UniqueRegionC, RE_UniqueRegionSet, 
    RE_UniqueRegionSetC, getUniqueGenomicRegions, getUniqueGenomicRegionsCrossReference, reformatUniqueGenomicRegions } from './reUtils'
import { Reset } from '@blueprintjs/icons'

export const RegulatoryElementPosition = MetaNode('RegulatoryElementPosition')
  .meta({
    label: 'Regulatory Element position',
    description: 'Regulatory Element position',
    icon: [linkeddatahub_icon],
  })
  .codec(RegulatoryElementInfoC)
  .view(regElem => (
    <div className="prose max-w-none"> {regElem.data.entId} Regulatory Element<br></br>Position: {regElem.data.coordinates.chromosome}: {regElem.data.coordinates.start}-{regElem.data.coordinates.end} (GRCh38)</div>
  ))
  .build()

export const GetRegulatoryElementPosition = MetaNode('GetRegulatoryElementPosition')
  .meta({
    label: 'Retrieve regulatory element position',
    description: 'Find regulatory element postion (GRCh38)',
    icon: [linkeddatahub_icon],
  })
  .inputs({ regulatoryElement: RegulatoryElementTerm })
  .output(RegulatoryElementPosition)
  .resolve(async (props) => {
    const rePositionData = await getRegElemPositionData(props.inputs.regulatoryElement);
    
    const response = await myRegElemInfo_query(props.inputs.regulatoryElement);
    if(response == null || response.data == null){
      throw new Error("Unable to get data from Linked Data Hub API, please try again or wait a few minutes before the next atempt!");
    }

    if(rePositionData != null && rePositionData.data.cCREQuery[0].coordinates != null){
      response.data.coordinates = rePositionData.data.cCREQuery[0].coordinates;
    }else{
      response.data.coordinates = {
          chromosome: "",
          start: 0,
          end: 0
      };
    }
    return response;
  })
  .story(props => ({ abstract: `Regulatory element genomic position.` }))
  .build()

export const GetGenesForRegulatoryElementInfo = MetaNode('GetGenesForRegulatoryElementInfo')
  .meta({
    label: 'Identify Genes In Vicinity',
    description: 'Identify genes in 10kbps distance of regulatory element.',
  })
  .inputs({  regulatoryElement: RegulatoryElementTerm   })
  .output(GeneSet)
  .resolve(async (props) => {
    const response = await myRegElemInfo_query(props.inputs.regulatoryElement);
    if(response == null || response.data == null){
      throw new Error("Unable to get data from Linked Data Hub API, please try again or wait a few minutes before the next atempt!");
    }

    let geneNames =  response.data.ldFor.Gene.map(({ entId }) => entId);
    let geneSet = {
      description: 'Gene set for regulatory element '+response.data.entId,
      set: geneNames
    };
    return geneSet;
  })
  .story(props => ({ abstract: `Genes linked to the regulatory element${props.inputs ? ` ${props.inputs.regulatoryElement}` : ''} were resolved.` }))
  .build()


  export const REGeneSet = MetaNode('REGeneSet')
  .meta({
    label: 'Genes Set For Each Regulatory Element In Set',
    description: '',
    icon: [datafile_icon]
  })
  .codec(
    z.array(z.object({
      reId: z.string(),
      genes: z.array(z.string())
    }))
  )
  .view(geneSetForEachRE => {
    return( 
      <>
        <p style={{fontSize: '14px'}}><b>Note:</b> In order to view all data, if avaliable, please expand the table rows!</p>
        <Table
          height={500}
          cellRendererDependencies={[geneSetForEachRE]}
          numRows={geneSetForEachRE.length}
          enableGhostCells
          enableFocusedCell
          downloads={{
            JSON: () => downloadBlob(new Blob([JSON.stringify(geneSetForEachRE)], { type: 'application/json;charset=utf-8' }), 'data.json')
          }}>
          <Column
            name="Entity id"
            cellRenderer={row => <Cell key={row+''}>{geneSetForEachRE[row].reId}</Cell>}
          />
          <Column
            name="Chromosome"
            cellRenderer={row => <Cell key={row+''}>
                  <table style={{borderCollapse: 'collapse', width:'100%'}}>
                    {geneSetForEachRE[row].genes.map(genes =>
                        <tr><td>{ genes }</td></tr>
                    )}
                  </table>
            </Cell>}
          />
        </Table>
      </>
    )
  })
  .build()


  export const GetGenesForRegulatoryElementSet = MetaNode('GetGenesForRegulatoryElementSet')
  .meta({
    label: 'Identify Genes In Vicinity',
    description: 'Identify genes in 10kbps distance of regulatory elements.',
  })
  .inputs({  regulatoryElementSet: RegulatoryElementSet  })
  .output(REGeneSet)
  .resolve(async (props) => {
    let reSet = props.inputs.regulatoryElementSet.set;

    let geneSetForEachRE = [];
    for(let i in reSet){
        let re = reSet[i];
        const response = await myRegElemInfo_query(re);
        if(response == null || response.data == null){
          continue;
        }

        let geneNames =  response.data.ldFor.Gene.map(({ entId }) => entId);
        let temp = {
          reId: re,
          genes: geneNames
        }
        geneSetForEachRE.push(temp);
    }
    return geneSetForEachRE;
  })
  .story(props => ({ abstract: `Genes linked to the regulatory element set.` }))
  .build()


export const GetVariantsForRegulatoryElementInfo = MetaNode('GetVariantListForRegulatoryElementInfo')
  .meta({
    label: 'Identify Variants Within Regulatory Element',
    description: 'Retrieve registered variants in the region of given regulatory element from Allele Registry',
  })
  .inputs({ regulatoryElement: RegulatoryElementTerm  })
  .output(VariantSet)
  .resolve(async (props) => {
    const response = await myRegElemInfo_query(props.inputs.regulatoryElement);
    if(response == null || response.data == null){
      throw new Error("Unable to get data from LInked Data Hub API, please try again or wait a few minutes before the next atempt!");
    }

    let variantNames =  response.data.ld.Variant.map(({ entId }) => entId);
    let variantSet = {
      description: 'Variant set for regulatory element '+response.data.entId,
      set: variantNames
    };
    return variantSet;
  })
  .story(props => ({ abstract: `Variants linked to the regulatory element${props.inputs ? ` ${props.inputs.regulatoryElement}` : ''} were resolved.` }))
  .build()

const MyRegulatoryElementC = z.object({
  entId: z.string(),
  ldhId: z.string(),
  entContent: z.object({
    coordinates: z.object({    
      chromosome: z.string(),
      end: z.any(),
      start: z.any()
    })
  })
})
export type MyRegulatoryElement = z.infer<typeof MyRegulatoryElementC>

export const MyRegulatoryElementSetInfoC = z.array(
  MyRegulatoryElementC
)
export type MyRegulatoryElementSetInfo = z.infer<typeof MyRegulatoryElementSetInfoC>

export const RegulatoryElementSetInfo = MetaNode('RegulatoryElementSetInfo')
  .meta({
    label: 'Regulatory Element Set Info',
    description: '',
    icon: [datafile_icon]
  })
  .codec(MyRegulatoryElementSetInfoC)
  .view(regulatoryElementSet => {
    return( 
      <>
        <p style={{fontSize: '14px'}}><b>Note:</b> In order to view all data, if avaliable, please expand the table rows!</p>
        <Table
          height={500}
          cellRendererDependencies={[regulatoryElementSet]}
          numRows={regulatoryElementSet.length}
          enableGhostCells
          enableFocusedCell
          downloads={{
            JSON: () => downloadBlob(new Blob([JSON.stringify(regulatoryElementSet)], { type: 'application/json;charset=utf-8' }), 'data.json')
          }}>
          <Column
            name="Entity id"
            cellRenderer={row => <Cell key={row+''}>{regulatoryElementSet[row].entId}</Cell>}
          />
          <Column
            name="Chromosome"
            cellRenderer={row => <Cell key={row+''}>{regulatoryElementSet[row].entContent.coordinates.chromosome}</Cell>}
          />
          <Column
            name="Start Pos."
            cellRenderer={row => <Cell key={row+''}>{regulatoryElementSet[row].entContent.coordinates.start}</Cell>}
          />
          <Column
            name="End Pos."
            cellRenderer={row => <Cell key={row+''}>{regulatoryElementSet[row].entContent.coordinates.end}</Cell>}
          />
        </Table>
      </>
    )
  })
  .build()

  export const MyGeneToRegulatoryElementSetInfoC = z.array(z.object({
    gene: z.string(),
    regulatoryElements: MyRegulatoryElementSetInfoC
  }))
  export type MyGeneToRegulatoryElementSetInfo = z.infer<typeof MyGeneToRegulatoryElementSetInfoC>

  export const RegulatoryElementSetForGeneSetInfo = MetaNode('RegulatoryElementSetForGeneSetInfo')
  .meta({
    label: 'Regulatory Element Set Info For Each Gene',
    description: '',
    icon: [datafile_icon]
  })
  .codec(MyGeneToRegulatoryElementSetInfoC)
  .view(reSetForEachGene => {
    return( 
      <>
        <p style={{fontSize: '14px'}}><b>Note:</b> In order to view all data, if avaliable, please expand the table rows!</p>
        <Table
          height={500}
          cellRendererDependencies={[reSetForEachGene]}
          numRows={reSetForEachGene.length}
          enableGhostCells
          enableFocusedCell
          downloads={{
            JSON: () => downloadBlob(new Blob([JSON.stringify(reSetForEachGene)], { type: 'application/json;charset=utf-8' }), 'data.json')
          }}>
          <Column
            name="Entity id"
            cellRenderer={row => <Cell key={row+''}>{reSetForEachGene[row].gene}</Cell>}
          />
          <Column
            name="Chromosome"
            cellRenderer={row => <Cell key={row+''}>
                  <table style={{borderCollapse: 'collapse', width:'100%'}}>
                    {reSetForEachGene[row].regulatoryElements.map(regulatoryElements =>
                        <tr><td>{ regulatoryElements.entId }</td></tr>
                    )}
                  </table>
            </Cell>}
          />
          <Column
            name="Start Pos."
            cellRenderer={row => <Cell key={row+''}>
                  <table style={{borderCollapse: 'collapse', width:'100%'}}>
                    {reSetForEachGene[row].regulatoryElements.map(regulatoryElements =>
                        <tr><td>{ regulatoryElements.entContent.coordinates.chromosome }</td></tr>
                    )}
                  </table>
            </Cell>}
          />
          <Column
            name="End Pos."
            cellRenderer={row => <Cell key={row+''}>
                  <table style={{borderCollapse: 'collapse', width:'100%'}}>
                    {reSetForEachGene[row].regulatoryElements.map(regulatoryElements =>
                        <tr><td>{ regulatoryElements.entContent.coordinates.start }</td></tr>
                    )}
                  </table>
            </Cell>}
          />
          <Column
            name="End Pos."
            cellRenderer={row => <Cell key={row+''}>
                  <table style={{borderCollapse: 'collapse', width:'100%'}}>
                    {reSetForEachGene[row].regulatoryElements.map(regulatoryElements =>
                        <tr><td>{ regulatoryElements.entContent.coordinates.end }</td></tr>
                    )}
                  </table>
            </Cell>}
          />
        </Table>
      </>
    )
  })
  .build()

export async function setGenomicPositionsForRegulatoryElementSet(regElemeIdsSet: string[]): Promise<MyRegulatoryElementSetInfo> {
  let response: MyRegulatoryElementSetInfo = [];
  for(let i in regElemeIdsSet){
    let rgId = regElemeIdsSet[i];
    const rePositionData = await getRegElemPositionData(rgId);

    let coordinates = null;
    if(rePositionData != null && rePositionData.data.cCREQuery[0] != null && rePositionData.data.cCREQuery[0].coordinates != null){
      coordinates = rePositionData.data.cCREQuery[0].coordinates;
    }else{
      coordinates = {
          chromosome: "",
          start: 0,
          end: 0
      };
    }
    let rgObj = {
      entId: rgId,
      ldhId: rgId,
      entContent: {
        coordinates: coordinates
      }
    }
    response.push(rgObj);
  }
  return response;
} 

export const RegElementSetInfoFromRegElementTerm = MetaNode('RegElementSetInfoFromRegElementTerm')
  .meta({
    label: 'Retrieve regulatory element positions',
    description: 'Find regulatory element postions (GRCh38).',
    icon: [linkeddatahub_icon],
  })
  .inputs({ regulatoryElementSet: RegulatoryElementSet })
  .output(RegulatoryElementSetInfo)
  .resolve(async (props) => {
    let regElemeIdsSet = props.inputs.regulatoryElementSet.set;
    return await setGenomicPositionsForRegulatoryElementSet(regElemeIdsSet);
  })
  .story(props => ({ abstract: `Find regulatory element postions (GRCh38).` }))
  .build()

  export const UniqueGenomicRegion = MetaNode('UniqueGenomicRegion')
  .meta({
    label: 'Unique Genomic Region',
    description: '',
    icon: [datafile_icon]
  })
  .codec(RE_UniqueRegionC)
  .view(uniqueRegions => {
    if(uniqueRegions == null || uniqueRegions.length == 0){
      return (
        <p>Nothing found on the queried position!</p>
      )
    }else{
      return( 
        <>
          <p style={{fontSize: '14px'}}><b>Note:</b> In order to view all data, if avaliable, please expand the table rows!</p>
          <Table
            height={500}
            cellRendererDependencies={[uniqueRegions]}
            numRows={uniqueRegions.length}
            enableGhostCells
            enableFocusedCell
            downloads={{
              JSON: () => downloadBlob(new Blob([JSON.stringify(uniqueRegions)], { type: 'application/json;charset=utf-8' }), 'data.json')
            }}>
            <Column
              name="@id"
              cellRenderer={row => <Cell key={row+''}>{uniqueRegions[row]['@id']}</Cell>}
            />
            <Column
              name="Title"
              cellRenderer={row => <Cell key={row+''}>{uniqueRegions[row].communityStandardTitle}</Cell>}
            />
            <Column
              name="Id"
              cellRenderer={row => <Cell key={row+''}>{uniqueRegions[row].id}</Cell>}
            />
            <Column
              name="Type"
              cellRenderer={row => <Cell key={row+''}>{uniqueRegions[row].type}</Cell>}
            />
          </Table>
        </>
      )
    }
  })
  .build()

  export const GetUniqueNameForGenomicRegions = MetaNode('GetUniqueNameForGenomicRegions')
  .meta({
    label: 'Get unique name for genomic region(s)',
    description: 'Get unique name for genomic location (if registered). Input format example: GRCh38 (chr1:826020-826220).',
    icon: [linkeddatahub_icon],
  })
  .inputs({ regulatoryElement: RegulatoryElementTerm })
  .output(UniqueGenomicRegion)
  .resolve(async (props) => {
    const rePositionData = await getRegElemPositionData(props.inputs.regulatoryElement);
    let positionString = rePositionData.data.cCREQuery[0].coordinates.chromosome+":"+rePositionData.data.cCREQuery[0].coordinates.start+"-"+rePositionData.data.cCREQuery[0].coordinates.end;
    let response = await getUniqueGenomicRegions(positionString);
    if(response == null){
      throw new Error("Unable to find any data for the queried position!");
    }
    return response;
  })
  .story(props => ({ abstract: `Get unique name for genomic region(s).` }))
  .build()

  export const UniqueGenomicRegionRESet = MetaNode('UniqueGenomicRegionRESet')
  .meta({
    label: 'Unique Genomic Region For Regulatory Elem. Set',
    description: '',
    icon: [datafile_icon]
  })
  .codec(RE_UniqueRegionSetC)
  .view(uniqueRegions => {
    if(uniqueRegions == null || uniqueRegions.length == 0){
      return (
        <p>Nothing found on the queried position!</p>
      )
    }else{
      return( 
        <>
          <p style={{fontSize: '14px'}}><b>Note:</b> In order to view all data, if avaliable, please expand the table rows!</p>
          <Table
            height={500}
            cellRendererDependencies={[uniqueRegions]}
            numRows={uniqueRegions.length}
            enableGhostCells
            enableFocusedCell
            downloads={{
              JSON: () => downloadBlob(new Blob([JSON.stringify(uniqueRegions)], { type: 'application/json;charset=utf-8' }), 'data.json')
            }}>
            <Column
              name="Regulatory Elem. id"
              cellRenderer={row => <Cell key={row+''}>{uniqueRegions[row].reId}</Cell>}
            />
            <Column
              name="Title"
              cellRenderer={row => <Cell key={row+''}>
                  <table style={{borderCollapse: 'collapse', width:'100%'}}>
                    {uniqueRegions[row].reference.map(reference =>
                        <tr><td>{ reference.communityStandardTitle }</td></tr>
                    )}
                  </table>
              </Cell>}
            />
            <Column
              name="Id"
              cellRenderer={row => <Cell key={row+''}>                  
                  <table style={{borderCollapse: 'collapse', width:'100%'}}>
                    {uniqueRegions[row].reference.map(reference =>
                      <tr><td>{ reference.id }</td></tr>
                    )}
                  </table>
                </Cell>}
            />
            <Column
              name="Type"
              cellRenderer={row => <Cell key={row+''}>
                  <table style={{borderCollapse: 'collapse', width:'100%'}}>
                    {uniqueRegions[row].reference.map(reference =>
                      <tr><td>{ reference.type }</td></tr>
                    )}
                  </table>
              </Cell>}
            />
          </Table>
        </>
      )
    }
  })
  .build()

  export const GetUniqueNameForGenomicRegionsRESet = MetaNode('GetUniqueNameForGenomicRegionsRESet')
  .meta({
    label: 'Get unique name for genomic region(s)',
    description: 'Get unique name for genomic region(s)',
    icon: [linkeddatahub_icon],
  })
  .inputs({ regulatoryElementSet: RegulatoryElementSet })
  .output(UniqueGenomicRegionRESet)
  .resolve(async (props) => {
    let regElemeIdsSet = props.inputs.regulatoryElementSet.set;
    let referenceArray: RE_UniqueRegionSet = [];
    for(let i in regElemeIdsSet){
      let rgId = regElemeIdsSet[i];
      const rePositionData = await getRegElemPositionData(rgId);

      let coordinates = null;
      if(rePositionData != null && rePositionData.data.cCREQuery[0] != null && rePositionData.data.cCREQuery[0].coordinates != null){
        coordinates = rePositionData.data.cCREQuery[0].coordinates;
      }else{
        continue;
      }

      if(coordinates != null){
        let positionString = coordinates.chromosome+":"+coordinates.start+"-"+coordinates.end;
        let response = await getUniqueGenomicRegions(positionString);
        if(response != null && response.length > 0){
          let tempObj = {
            reId: rgId,
            reference: response
          }    
          referenceArray.push(tempObj);  
        }
      }
    }
    return referenceArray;
  })
  .story(props => ({ abstract: `Get unique name for genomic region(s)` }))
  .build()

  export const UniqueGenomicRegionCrossReference = MetaNode('UniqueGenomicRegionCrossReference')
  .meta({
    label: 'Unique Genomic Region Cross Reference',
    description: '',
    icon: [datafile_icon]
  })
  .codec(z.string())
  .view(uniqueRegionsCrossReference => { 
      if(uniqueRegionsCrossReference == null || uniqueRegionsCrossReference == ''){
        return(<p>Unable to find any unique region(s) for the queried position!</p>)
      }else{
        return(<p>{uniqueRegionsCrossReference}</p>)
      }
  })
  .build()

  export const GenomicRegionCoordinateTransformationAcrossReferences = MetaNode('GenomicRegionCoordinateTransformationAcrossReferences')
  .meta({
    label: 'Genomic region coordinate transformation across references',
    description: 'Get unique name for genomic region(s) cross refenrce: GRCh38, GRCh37 and NCBI36.',
    icon: [linkeddatahub_icon],
  })
  .inputs({ regulatoryElement: RegulatoryElementTerm })
  .output(UniqueGenomicRegionCrossReference)
  .resolve(async (props) => {
    const rePositionData = await getRegElemPositionData(props.inputs.regulatoryElement);
    let positionString = rePositionData.data.cCREQuery[0].coordinates.chromosome+":"+rePositionData.data.cCREQuery[0].coordinates.start+"-"+rePositionData.data.cCREQuery[0].coordinates.end;
    let response = await getUniqueGenomicRegionsCrossReference(positionString);
    let references = reformatUniqueGenomicRegions(response);
    return props.inputs.regulatoryElement+" ("+positionString+"):  "+references.toLocaleString();
  })
  .story(props => ({ abstract: `Get unique name for genomic region(s) cross refenrce: GRCh38, GRCh37 and NCBI36.` }))
  .build()


  export const UniqueGenomicRegionCrossReferenceRESet = MetaNode('UniqueGenomicRegionCrossReferenceRESet')
  .meta({
    label: 'Unique Genomic Region Cross Reference',
    description: '',
    icon: [datafile_icon]
  })
  .codec(z.array(
    z.object({
      reId: z.string().optional(),
      rePosition: z.string(),
      reference: z.array(z.string())
    }).optional()
  ).nullable().optional())
  .view(uniqueRegionsCrossReferenceList => { 
      if(uniqueRegionsCrossReferenceList == null || uniqueRegionsCrossReferenceList.length == 0){
        return(<p>Unable to find any unique region(s) for the queried positions!</p>)
      }else{
        return(
          <>
            <p style={{fontSize: '14px'}}><b>Note:</b> In order to view all data, if avaliable, please expand the table rows!</p>
            <Table
              height={500}
              cellRendererDependencies={[uniqueRegionsCrossReferenceList]}
              numRows={uniqueRegionsCrossReferenceList.length}
              enableGhostCells
              enableFocusedCell
              downloads={{
                JSON: () => downloadBlob(new Blob([JSON.stringify(uniqueRegionsCrossReferenceList)], { type: 'application/json;charset=utf-8' }), 'data.json')
              }}>
              <Column
                name="Regulatory Element id"
                cellRenderer={row => <Cell key={row+''}>{uniqueRegionsCrossReferenceList[row]?.reId}</Cell>}
              />
              <Column
                name="Position"
                cellRenderer={row => <Cell key={row+''}>{uniqueRegionsCrossReferenceList[row]?.rePosition}</Cell>}
              />
              <Column
                name="Cross Reference(s)"
                cellRenderer={row => <Cell key={row+''}>{
                    <table style={{borderCollapse: 'collapse', width:'100%'}}>
                      {uniqueRegionsCrossReferenceList[row]?.reference.map(reference =>
                          <tr><td>{ reference }</td></tr>
                      )}
                    </table>
                  }</Cell>}
              />
            </Table>
          </>
        )
      }
  })
  .build()

  export const GenomicRegionCoordinateTransformationAcrossReferencesRE_Set = MetaNode('GenomicRegionCoordinateTransformationAcrossReferencesRE_Set')
  .meta({
    label: 'Genomic region coordinate transformation across references',
    description: 'Get unique name for genomic region(s) cross refenrce: GRCh38, GRCh37 and NCBI36.',
    icon: [linkeddatahub_icon],
  })
  .inputs({ regulatoryElementSet: RegulatoryElementSet })
  .output(UniqueGenomicRegionCrossReferenceRESet)
  .resolve(async (props) => {
    let regElemeIdsSet = props.inputs.regulatoryElementSet.set;
    let referenceArray = [];
    for(let i in regElemeIdsSet){
      let rgId = regElemeIdsSet[i];
      const rePositionData = await getRegElemPositionData(rgId);

      let coordinates = null;
      if(rePositionData != null && rePositionData.data.cCREQuery[0] != null && rePositionData.data.cCREQuery[0].coordinates != null){
        coordinates = rePositionData.data.cCREQuery[0].coordinates;
      }else{
        continue;
      }

      if(coordinates != null){
        let positionString = coordinates.chromosome+":"+coordinates.start+"-"+coordinates.end;
        let references = await getUniqueGenomicRegionsCrossReference(positionString); 
        if(references == null || references == ''){
          continue;
        }
        let reformatedReferences = reformatUniqueGenomicRegions(references);
        let tempObj = {
          reId: rgId,
          rePosition: positionString,
          reference: reformatedReferences
        }    
        referenceArray.push(tempObj);  
      }
    }
    return referenceArray;
  })
  .story(props => ({ abstract: `Get unique name for genomic region(s) cross refenrce: GRCh38, GRCh37 and NCBI36.` }))
  .build()
