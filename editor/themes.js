export const EDITOR_THEMES={
 forest:{sceneId:'forest-01',name:'숲속',title:'숲속 장면 만들기',categories:{trees:'나무',rocks:'바위',props:'다리·통나무·그루터기',bushes:'수풀',grass:'풀',flowers:'꽃',mushrooms:'버섯',plants:'기타 식물'}},
 sea:{sceneId:'sea-01',name:'모래사장과 얕은 바다',title:'바다 장면 만들기',categories:{palms:'야자수',rocks:'해안 바위',plants:'해안 풀',shells:'조개·불가사리',corals:'얕은 바다 산호',props:'통나무·작은 배'}}
};
export function editorTheme(search){const requested=new URLSearchParams(search).get('theme');const key=Object.hasOwn(EDITOR_THEMES,requested)?requested:'forest';return {key,...EDITOR_THEMES[key]};}
