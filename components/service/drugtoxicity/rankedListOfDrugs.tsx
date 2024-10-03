import { MetaNode } from '@/spec/metanode'
import { z } from 'zod'
import python from '@/utils/python'
import { Table, Cell, Column } from '@/app/components/Table'
import { drug_icon } from '@/icons'
import { downloadBlob } from '@/utils/download'
import { ScoredDrugs } from '@/components/core/scored'
import { Button } from '@blueprintjs/core'
import { DrugCytotoxictyChembl } from './drugyCytotoxicityChembl'


export const RankedDrugToxicity = MetaNode(`[RankedDrugToxicityTable]`)
    .meta({
        label: 'Ranked Drug Toxicity',
        description: `Drugs Ranked by Cytotoxicity, Blood Brain Barrier and DrugShot`,
        icon: [drug_icon]
    })
    .codec(z.array(z.object({
        drug_name: z.string(),
        confidence_zscore: z.string(),
        cytotoxicity_mean: z.string(),
    })))
    .view(rankedListTable => {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex flex-row gap-2">
                    <Button>Sort Drug Name</Button>
                    <Button>Sort Confidence Score</Button>
                    <Button>Sort Cytotoxicity</Button>
                </div>
                <Table
                    height={500}
                    cellRendererDependencies={[rankedListTable]}
                    numRows={rankedListTable.length}
                    enableGhostCells
                    enableFocusedCell

                >
                    <Column
                        name="Drug Name"
                        cellRenderer={row => <Cell key={row + ''}>{rankedListTable[row].drug_name}</Cell>}
                    />
                    <Column
                        name="Confidence ZScore"
                        cellRenderer={row => <Cell key={row + ''}>{rankedListTable[row].confidence_zscore}</Cell>}
                    />
                    <Column
                        name="Cytotoxicity Mean"
                        cellRenderer={row => <Cell key={row + ''}>{rankedListTable[row].cytotoxicity_mean}</Cell>}
                    />
                </Table>
            </div>
        )
    }).build()

export const RankedListDrugToxicity = MetaNode(`[RankedListOfDrugsCandidates]`)
    .meta({
        label: 'Ranked List of Drug Candidates',
        description: 'Rank List of Drug Candidates via Cytotoxicity, Blood Brain Barrier, and Confidence Score'
    })
    .inputs({ ScoredDrugs, DrugCytotoxictyChembl })
    .output(RankedDrugToxicity)
    .resolve(async (props) => {
        return await python(
            'components.service.drugtoxicity.produce_ranked_drug_candidates',
            { kargs: [props.inputs.ScoredDrugs, props.inputs.DrugCytotoxictyChembl] },
            message => props.notify({ type: 'info', message }),
        )
    })
    .story(props => ({

    }))
    .build()