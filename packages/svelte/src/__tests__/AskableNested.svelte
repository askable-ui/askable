<script>
  import Askable from '../Askable.svelte';
</script>

<Askable meta={{ view: 'dashboard' }}>
  <Askable meta={{ tab: 'finance' }}>
    <Askable meta={{ metric: 'revenue' }}>Revenue Chart</Askable>
  </Askable>
</Askable>
