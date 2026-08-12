import{s as t}from"./B-_lM_Ph.js";import{ap as a,o as s,c as n,U as p,aD as c}from"./D-bY05Sj.js";import{s as r}from"./jc0MLXVe.js";import"./Dgteexcm.js";var i=`
    .p-checkbox-group {
        display: inline-flex;
    }
`,u={root:"p-checkbox-group p-component"},m=a.extend({name:"checkboxgroup",style:i,classes:u}),l={name:"BaseCheckboxGroup",extends:t,style:m,provide:function(){return{$pcCheckboxGroup:this,$parentInstance:this}}},h={name:"CheckboxGroup",extends:l,inheritAttrs:!1,data:function(){return{groupName:this.name}},watch:{name:function(o){this.groupName=o||r("checkbox-group-")}},mounted:function(){this.groupName=this.groupName||r("checkbox-group-")}};function d(e,o,x,f,k,g){return s(),n("div",c({class:e.cx("root")},e.ptmi("root")),[p(e.$slots,"default")],16)}h.render=d;export{h as default};
