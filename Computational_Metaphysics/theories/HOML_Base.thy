(*  Title:      HOML_Base.thy
    Purpose:    Shallow semantical embedding of higher-order modal logic (HOML)
                in Isabelle/HOL, following the LogiKEy methodology
                (Benzmüller, Parent & van der Torre 2020; Benzmüller & Woltzenlogel
                Paleo 2014).

    Conventions used by the harness and by mcp_server/nitpick_parser.py:
      * type  i            possible worlds        (Nitpick atoms  i⇩1, i⇩2, ...)
      * type  e            individuals            (Nitpick atoms  e⇩1, e⇩2, ...)
      * const r            accessibility relation (shown as "r" in Nitpick models)
      * σ = i ⇒ bool       world-lifted propositions
      * ⌊φ⌋                global validity (truth in every world)

    The base logic is K. Stronger logics are obtained by *assuming* frame
    conditions in the generated theory, e.g.
        axiomatization where S5_frame: "equivalence r"
    Those assumptions are axioms like any other and are therefore subject to the
    A3 consistency gate.
*)
theory HOML_Base
  imports Main
begin

typedecl i                      \<comment> \<open>possible worlds\<close>
typedecl e                      \<comment> \<open>individuals\<close>
type_synonym \<sigma> = "i \<Rightarrow> bool"   \<comment> \<open>world-lifted propositions\<close>

consts r :: "i \<Rightarrow> i \<Rightarrow> bool" (infixr "r" 70)   \<comment> \<open>accessibility\<close>

section \<open>Propositional connectives\<close>

abbreviation mtop :: "\<sigma>" ("\<^bold>\<top>") where "\<^bold>\<top> \<equiv> \<lambda>w. True"
abbreviation mbot :: "\<sigma>" ("\<^bold>\<bottom>") where "\<^bold>\<bottom> \<equiv> \<lambda>w. False"
abbreviation mnot :: "\<sigma> \<Rightarrow> \<sigma>" ("\<^bold>\<not>_" [52] 53)
  where "\<^bold>\<not>\<phi> \<equiv> \<lambda>w. \<not>\<phi> w"
abbreviation mand :: "\<sigma> \<Rightarrow> \<sigma> \<Rightarrow> \<sigma>" (infixr "\<^bold>\<and>" 51)
  where "\<phi> \<^bold>\<and> \<psi> \<equiv> \<lambda>w. \<phi> w \<and> \<psi> w"
abbreviation mor :: "\<sigma> \<Rightarrow> \<sigma> \<Rightarrow> \<sigma>" (infixr "\<^bold>\<or>" 50)
  where "\<phi> \<^bold>\<or> \<psi> \<equiv> \<lambda>w. \<phi> w \<or> \<psi> w"
abbreviation mimp :: "\<sigma> \<Rightarrow> \<sigma> \<Rightarrow> \<sigma>" (infixr "\<^bold>\<rightarrow>" 49)
  where "\<phi> \<^bold>\<rightarrow> \<psi> \<equiv> \<lambda>w. \<phi> w \<longrightarrow> \<psi> w"
abbreviation mequ :: "\<sigma> \<Rightarrow> \<sigma> \<Rightarrow> \<sigma>" (infixr "\<^bold>\<leftrightarrow>" 48)
  where "\<phi> \<^bold>\<leftrightarrow> \<psi> \<equiv> \<lambda>w. \<phi> w \<longleftrightarrow> \<psi> w"

section \<open>Modal operators (Kripke semantics over r)\<close>

abbreviation mbox :: "\<sigma> \<Rightarrow> \<sigma>" ("\<^bold>\<box>_" [52] 53)
  where "\<^bold>\<box>\<phi> \<equiv> \<lambda>w. \<forall>v. w r v \<longrightarrow> \<phi> v"
abbreviation mdia :: "\<sigma> \<Rightarrow> \<sigma>" ("\<^bold>\<diamond>_" [52] 53)
  where "\<^bold>\<diamond>\<phi> \<equiv> \<lambda>w. \<exists>v. w r v \<and> \<phi> v"

section \<open>Quantifiers\<close>

text \<open>Possibilist (constant-domain) quantifiers over any type.\<close>
abbreviation mforall :: "('a \<Rightarrow> \<sigma>) \<Rightarrow> \<sigma>" ("\<^bold>\<forall>")
  where "\<^bold>\<forall>\<Phi> \<equiv> \<lambda>w. \<forall>x. \<Phi> x w"
abbreviation mforallB :: "('a \<Rightarrow> \<sigma>) \<Rightarrow> \<sigma>" (binder "\<^bold>\<forall>" [8] 9)
  where "\<^bold>\<forall>x. \<phi> x \<equiv> \<^bold>\<forall>\<phi>"
abbreviation mexists :: "('a \<Rightarrow> \<sigma>) \<Rightarrow> \<sigma>" ("\<^bold>\<exists>")
  where "\<^bold>\<exists>\<Phi> \<equiv> \<lambda>w. \<exists>x. \<Phi> x w"
abbreviation mexistsB :: "('a \<Rightarrow> \<sigma>) \<Rightarrow> \<sigma>" (binder "\<^bold>\<exists>" [8] 9)
  where "\<^bold>\<exists>x. \<phi> x \<equiv> \<^bold>\<exists>\<phi>"

text \<open>Actualist (varying-domain) quantifiers over individuals, relative to a
  world-dependent existence predicate. Spinoza-style theories that need
  actual existence should use these.\<close>
consts existsAt :: "e \<Rightarrow> \<sigma>" ("\<^bold>E!")
abbreviation mforallAct :: "(e \<Rightarrow> \<sigma>) \<Rightarrow> \<sigma>" ("\<^bold>\<forall>\<^sup>E")
  where "\<^bold>\<forall>\<^sup>E\<Phi> \<equiv> \<lambda>w. \<forall>x. existsAt x w \<longrightarrow> \<Phi> x w"
abbreviation mexistsAct :: "(e \<Rightarrow> \<sigma>) \<Rightarrow> \<sigma>" ("\<^bold>\<exists>\<^sup>E")
  where "\<^bold>\<exists>\<^sup>E\<Phi> \<equiv> \<lambda>w. \<exists>x. existsAt x w \<and> \<Phi> x w"

text \<open>Leibniz equality lifted to worlds.\<close>
abbreviation meq :: "'a \<Rightarrow> 'a \<Rightarrow> \<sigma>" (infixr "\<^bold>=" 90)
  where "x \<^bold>= y \<equiv> \<lambda>w. x = y"

section \<open>Validity\<close>

abbreviation mvalid :: "\<sigma> \<Rightarrow> bool" ("\<lfloor>_\<rfloor>" [7] 105)
  where "\<lfloor>\<phi>\<rfloor> \<equiv> \<forall>w. \<phi> w"
text \<open>Truth at a designated world w is written simply as \<open>\<phi> w\<close>.\<close>

section \<open>Frame conditions (assume them explicitly; never built in)\<close>

definition refl_frame  :: bool where "refl_frame  \<equiv> \<forall>x. x r x"
definition trans_frame :: bool where "trans_frame \<equiv> \<forall>x y z. x r y \<and> y r z \<longrightarrow> x r z"
definition sym_frame   :: bool where "sym_frame   \<equiv> \<forall>x y. x r y \<longrightarrow> y r x"

abbreviation T_frame  :: bool where "T_frame  \<equiv> refl_frame"
abbreviation S4_frame :: bool where "S4_frame \<equiv> refl_frame \<and> trans_frame"
abbreviation S5_frame :: bool where "S5_frame \<equiv> refl_frame \<and> trans_frame \<and> sym_frame"

section \<open>Sanity checks of the embedding\<close>

lemma K_schema: "\<lfloor>\<^bold>\<box>(\<phi> \<^bold>\<rightarrow> \<psi>) \<^bold>\<rightarrow> (\<^bold>\<box>\<phi> \<^bold>\<rightarrow> \<^bold>\<box>\<psi>)\<rfloor>" by blast
lemma T_needs_reflexivity: "refl_frame \<Longrightarrow> \<lfloor>\<^bold>\<box>\<phi> \<^bold>\<rightarrow> \<phi>\<rfloor>"
  unfolding refl_frame_def by blast
lemma "\<lfloor>\<^bold>\<box>\<phi> \<^bold>\<rightarrow> \<phi>\<rfloor>"
  nitpick [expect = genuine, card i = 1-2] \<comment> \<open>K alone does not validate T\<close>
  oops

end
