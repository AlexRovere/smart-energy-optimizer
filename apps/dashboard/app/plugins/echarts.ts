// ECharts s'importe à la carte : seuls le rendu SVG, les courbes et les
// composants utilisés par app/utils/charts.ts entrent dans le bundle.
import { LineChart } from 'echarts/charts'
import { GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'

export default defineNuxtPlugin(() => {
  use([SVGRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent])
})
