import{s as b}from"./lKvqzWBe.js";import{s as f}from"./2k310LUl.js";import y from"./BIZUfZVp.js";import{R as v}from"./X-SH5NDF.js";import{s as w}from"./CTKuEETe.js";import{ay as B,aj as k,o as s,c as i,a as d,Y as r,aM as t,t as P,m as c,n as $,b as g,w as h,l as C,aN as D,aQ as A,b0 as S,aO as I}from"./D4ZcQoMT.js";import{f as K}from"./ZhWAdK_X.js";import"./CVDC9Q9J.js";import"./D2QH6GNv.js";import"./BvQw6NnI.js";import"./DOOWzDqo.js";import"./jc0MLXVe.js";var L=`
    .p-panel {
        display: block;
        border: 1px solid dt('panel.border.color');
        border-radius: dt('panel.border.radius');
        background: dt('panel.background');
        color: dt('panel.color');
    }

    .p-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: dt('panel.header.padding');
        background: dt('panel.header.background');
        color: dt('panel.header.color');
        border-style: solid;
        border-width: dt('panel.header.border.width');
        border-color: dt('panel.header.border.color');
        border-radius: dt('panel.header.border.radius');
    }

    .p-panel-toggleable .p-panel-header {
        padding: dt('panel.toggleable.header.padding');
    }

    .p-panel-title {
        line-height: 1;
        font-weight: dt('panel.title.font.weight');
    }

    .p-panel-content-container {
        display: grid;
        grid-template-rows: 1fr;
    }

    .p-panel-content-wrapper {
        min-height: 0;
    }

    .p-panel-content {
        padding: dt('panel.content.padding');
    }

    .p-panel-footer {
        padding: dt('panel.footer.padding');
    }
`,N={root:function(n){var u=n.props;return["p-panel p-component",{"p-panel-toggleable":u.toggleable}]},header:"p-panel-header",title:"p-panel-title",headerActions:"p-panel-header-actions",pcToggleButton:"p-panel-toggle-button",contentContainer:"p-panel-content-container",contentWrapper:"p-panel-content-wrapper",content:"p-panel-content",footer:"p-panel-footer"},T=B.extend({name:"panel",style:L,classes:N}),E={name:"BasePanel",extends:w,props:{header:String,toggleable:Boolean,collapsed:Boolean,toggleButtonProps:{type:Object,default:function(){return{severity:"secondary",text:!0,rounded:!0}}}},style:T,provide:function(){return{$pcPanel:this,$parentInstance:this}}},j={name:"Panel",extends:E,inheritAttrs:!1,emits:["update:collapsed","toggle"],data:function(){return{d_collapsed:this.collapsed}},watch:{collapsed:function(n){this.d_collapsed=n}},methods:{toggle:function(n){this.d_collapsed=!this.d_collapsed,this.$emit("update:collapsed",this.d_collapsed),this.$emit("toggle",{originalEvent:n,value:this.d_collapsed})},onKeyDown:function(n){(n.code==="Enter"||n.code==="NumpadEnter"||n.code==="Space")&&(this.toggle(n),n.preventDefault())}},computed:{buttonAriaLabel:function(){return this.toggleButtonProps&&this.toggleButtonProps.ariaLabel?this.toggleButtonProps.ariaLabel:this.header},dataP:function(){return K({toggleable:this.toggleable})}},components:{PlusIcon:f,MinusIcon:b,Button:y},directives:{ripple:v}},M=["data-p"],V=["data-p"],W=["id"],O=["id","aria-labelledby"];function R(e,n,u,z,l,o){var m=k("Button");return s(),i("div",t({class:e.cx("root"),"data-p":o.dataP},e.ptmi("root")),[d("div",t({class:e.cx("header"),"data-p":o.dataP},e.ptm("header")),[r(e.$slots,"header",{id:e.$id+"_header",class:$(e.cx("title")),collapsed:l.d_collapsed},function(){return[e.header?(s(),i("span",t({key:0,id:e.$id+"_header",class:e.cx("title")},e.ptm("title")),P(e.header),17,W)):c("",!0)]}),d("div",t({class:e.cx("headerActions")},e.ptm("headerActions")),[r(e.$slots,"icons"),e.toggleable?r(e.$slots,"togglebutton",{key:0,collapsed:l.d_collapsed,toggleCallback:function(p){return o.toggle(p)},keydownCallback:function(p){return o.onKeyDown(p)}},function(){return[g(m,t({id:e.$id+"_header",class:e.cx("pcToggleButton"),"aria-label":o.buttonAriaLabel,"aria-controls":e.$id+"_content","aria-expanded":!l.d_collapsed,unstyled:e.unstyled,onClick:n[0]||(n[0]=function(a){return o.toggle(a)}),onKeydown:n[1]||(n[1]=function(a){return o.onKeyDown(a)})},e.toggleButtonProps,{pt:e.ptm("pcToggleButton")}),{icon:h(function(a){return[r(e.$slots,e.$slots.toggleicon?"toggleicon":"togglericon",{collapsed:l.d_collapsed},function(){return[(s(),C(D(l.d_collapsed?"PlusIcon":"MinusIcon"),t({class:a.class},e.ptm("pcToggleButton").icon),null,16,["class"]))]})]}),_:3},16,["id","class","aria-label","aria-controls","aria-expanded","unstyled","pt"])]}):c("",!0)],16)],16,V),g(I,t({name:"p-collapsible"},e.ptm("transition")),{default:h(function(){return[A(d("div",t({id:e.$id+"_content",class:e.cx("contentContainer"),role:"region","aria-labelledby":e.$id+"_header"},e.ptm("contentContainer")),[d("div",t({class:e.cx("contentWrapper")},e.ptm("contentWrapper")),[d("div",t({class:e.cx("content")},e.ptm("content")),[r(e.$slots,"default")],16),e.$slots.footer?(s(),i("div",t({key:0,class:e.cx("footer")},e.ptm("footer")),[r(e.$slots,"footer")],16)):c("",!0)],16)],16,O),[[S,!l.d_collapsed]])]}),_:3},16)],16,M)}j.render=R;export{j as default};
