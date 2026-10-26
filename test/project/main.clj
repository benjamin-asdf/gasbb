(ns main
  (:require [gasbb.sheets :as sheets]
            [util.text :as text]))

(defn greet [who]
  (println "greeting" who)
  {:greeting (text/shout (str "hello " who)) :n 3})

(defn people []
  (->> (sheets/read-maps "People")
       (filter #(> (:age %) 30))
       (map :first-name)))

(defn report! []
  (sheets/write-rows! "Report" (sheets/maps->rows [:name :age] [{:name "a" :age 1} {:name "b"}])))
