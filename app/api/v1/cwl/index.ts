import { z } from 'zod'
import { API } from '@/spec/api'
import { cwl_for_playbook } from '@/core/fpl2cwl'
import fpprg from '@/app/fpprg'
import krg from '@/app/krg'
import { NotFoundError } from '@/spec/error'
import JSZip from 'jszip'
import YAML from 'yaml'
import * as dict from '@/utils/dict'

export const CWLForPlaybook = API.get('/api/v1/cwl/[fpl_id]')
  .query(z.object({
    fpl_id: z.string(),
  }))
  .call(async (inputs, req, res) => {
    const fpl = await fpprg.getFPL(inputs.query.fpl_id)
    if (fpl === undefined) throw new NotFoundError()
    const cwl_files = await cwl_for_playbook({ krg, fpl })
    const zip = new JSZip()
    dict.items(cwl_files).forEach(({ key, value }) => {
      zip.file(key, YAML.stringify(value))
    })
    zip.generateNodeStream().pipe(res)
  })
  .build()
