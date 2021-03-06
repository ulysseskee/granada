import antlr4 from "antlr4";
// import fs from "fs";
import ScillaLexer from "./scillaLexer.js";
import ScillaParser from "./scillaParser.js";
import { Error } from "./syntax.js";
import * as SS from "./syntax.js";
import ScillaTypeChecker, * as TC from "./typechecker.js";
import _ from "lodash";
import TranslateVisitor from "./translate.js";
import { Constructor, DataTypeDict } from "./datatypes.js";
import * as TCU from "./typecheckerUtil.js";
import Evaluator from "./evalSyntax.js";
import { evalLmod } from "./evalImpure.js";
import SyntaxVisitor from "./syntaxVisitor.js";
import {
  BoolUtils,
  Conversions,
  CryptoUtils,
  IntUtils,
  ListUtils,
  NatUtils,
  PairUtils,
  Polynetwork,
  ShogiLib,
} from "./stdlib.js";

//How error is propagated - function will return the error if tcerror has received an error
//Issue - sometimes when a function result is an error and it's not noticed, the Error() object
//would be evaluated.
//Fix: we no longer return the Error() but rather just undefined. that way things break earlier

export var tcerror = undefined;
export var hideError = false;

export function setError(er) {
  // console.log(er);
  if (tcerror === undefined) {
    tcerror = er;
  }
}

export function isError() {
  if (!hideError) {
    return tcerror !== undefined;
  } else {
    return false;
  }
}

export function setHideError(t) {
  hideError = t;
  return;
}

export function getError() {
  return tcerror;
}

export function resetErrorSettings() {
  hideError = false;
  tcerror = undefined;
}

const stdlib = [
  BoolUtils,
  Conversions,
  CryptoUtils,
  IntUtils,
  ListUtils,
  NatUtils,
  PairUtils,
  Polynetwork,
  ShogiLib,
];

//Parse all standard libraries
export function parseAllStdLibs() {
  const parsedLibs = {};

  //1. Parse all libraries
  for (let i = 0; i < stdlib.length; i++) {
    // const input = fs
    //   .readFileSync("stdlib/".concat(stdlib[i]).concat(".scillib"))
    //   .toString();
    const input = stdlib[i];
    const chars = new antlr4.InputStream(input);
    const lexer = new ScillaLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new ScillaParser(tokens);
    const tree = parser.lmodule();
    const lmod = tree.accept(new TranslateVisitor());
    parsedLibs[stdlib[i]] = lmod;
  }
  return parsedLibs;
}

export function parseLib(libname) {
  // const input = fs
  //   .readFileSync("stdlib/".concat(libname).concat(".scillib"))
  //   .toString();
  const input = libname;
  const chars = new antlr4.InputStream(input);
  const lexer = new ScillaLexer(chars);
  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new ScillaParser(tokens);
  const tree = parser.lmodule();
  const lmod = tree.accept(new TranslateVisitor());
  return lmod;
}

//Starting type environment that contains all library functions and library ADTs
//Which also type checks the library functions
//Return the tenv and the typechecker with updated ADTs
//Note: currently ignores all lentries that fail because of unimplemented stdlibs
export function startingTEnv() {
  const parsedLibs = parseAllStdLibs();
  var tenv = {};
  var STC = new ScillaTypeChecker();
  var lmodDone = []; //String[] //IMPORTANT: we skip those named

  //2. Type check all modules
  //Note: the function currently doesn't fail with error.
  for (const lmod in parsedLibs) {
    console.log("Input: " + lmod);
    if (lmodDone.find((l) => l === lmod)) {
      continue;
    }
    const res = TC.typeLmod(parsedLibs[lmod], tenv, STC);
    if (isError()) {
      resetErrorSettings();
      continue;
    }
    tenv = res.tenv;
    STC = res.STC;
    lmodDone.concat(res.lmodDone);
  }

  //Return the tenv and the typechecker with updated ADTs
  return [tenv, STC];
}

export var printLog = false;
export var logOutput = "";
export function setPrintFalse() {
  printLog = false;
}
export function setPrintTrue() {
  printLog = true;
}
export function resetLogOutput() {
  logOutput = "";
}
export function addLineToLogOutput(line) {
  logOutput = logOutput + "\n" + line;
}

export function startingEEnv() {
  setPrintFalse();
  const parsedLibs = parseAllStdLibs();
  let env = {};
  let ScillaEvaluator = new Evaluator(env);

  let lmodDone = [];
  for (const lmod in parsedLibs) {
    //stdlib.length
    // console.log("Input: " + lmod);
    if (parsedLibs[lmod].lib.lname in lmodDone) {
      continue;
    } else {
      const res = evalLmod(parsedLibs[lmod], env, ScillaEvaluator.ADTDict);
      lmodDone = lmodDone.concat(res.lmodDone);
    }
  }

  return [env, ScillaEvaluator];
}
